import json
import logging
import time
from pathlib import Path
from typing import Optional

import requests
import pandas as pd
from tqdm import tqdm

from pipeline.config import OPENCRITIC_BASE_URL, OPENCRITIC_RATE_LIMIT_DELAY
from pipeline.utils import normalize_title, best_fuzzy_match, retry, rate_limited

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.82

# Wrap the raw request functions with rate limiting
_request_delay = OPENCRITIC_RATE_LIMIT_DELAY


@retry(max_attempts=3)
def _get(url: str, params: Optional[dict] = None) -> dict | list:
    time.sleep(_request_delay)
    resp = requests.get(url, params=params, timeout=15)
    if resp.status_code == 429:
        logger.warning("OpenCritic rate limit hit — waiting 10s")
        time.sleep(10)
        resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def search_opencritic(title: str) -> list[dict]:
    try:
        results = _get(f"{OPENCRITIC_BASE_URL}/game/search", params={"criteria": title})
        return results if isinstance(results, list) else []
    except requests.RequestException as exc:
        logger.debug("OpenCritic search failed for %r: %s", title, exc)
        return []


def fetch_game_scores(game_id: int) -> dict:
    try:
        data = _get(f"{OPENCRITIC_BASE_URL}/game/{game_id}")
        return {
            "critic_score": data.get("topCriticScore"),
            "user_score": data.get("percentRecommended"),
            "num_reviews": data.get("numReviews", 0),
        }
    except requests.RequestException as exc:
        logger.debug("OpenCritic score fetch failed for id=%d: %s", game_id, exc)
        return {"critic_score": None, "user_score": None, "num_reviews": 0}


def match_title(title: str, candidates: list[dict]) -> tuple[Optional[dict], float]:
    if not candidates:
        return None, 0.0
    candidate_names = [c.get("name", "") for c in candidates]
    best_name, score = best_fuzzy_match(title, candidate_names, threshold=CONFIDENCE_THRESHOLD)
    if best_name is None:
        return None, score
    matched = next(c for c in candidates if c.get("name") == best_name)
    return matched, score


def fetch_scores_for_title(title: str) -> dict:
    base = {
        "title": title,
        "critic_score": None,
        "user_score": None,
        "oc_confidence": 0.0,
        "oc_matched_title": None,
    }
    candidates = search_opencritic(title)
    if not candidates:
        return base

    matched, score = match_title(title, candidates)
    base["oc_confidence"] = score
    if not matched:
        return base

    base["oc_matched_title"] = matched.get("name")
    game_id = matched.get("id")
    if game_id is None:
        return base

    scores = fetch_game_scores(game_id)
    base.update(scores)
    return base


def fetch_opencritic_data(titles: list[str], cache_path: Path) -> pd.DataFrame:
    # Load existing cache
    cache: dict[str, dict] = {}
    if cache_path.exists():
        try:
            with cache_path.open("r", encoding="utf-8") as f:
                cache = json.load(f)
            logger.info("OpenCritic cache loaded: %d entries", len(cache))
        except (json.JSONDecodeError, OSError):
            logger.warning("OpenCritic cache corrupted — starting fresh")

    to_fetch = [t for t in titles if t not in cache]
    logger.info("OpenCritic: %d titles to fetch (%d already cached)", len(to_fetch), len(cache))

    if to_fetch:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        for title in tqdm(to_fetch, desc="OpenCritic", unit="title"):
            result = fetch_scores_for_title(title)
            cache[title] = result
            # Save after every fetch so a crash doesn't lose progress
            with cache_path.open("w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False)

    if not cache:
        return _empty_oc_df()

    rows = list(cache.values())
    df = pd.DataFrame(rows)
    df["title_key"] = df["title"].apply(normalize_title)
    logger.info("OpenCritic data: %d rows", len(df))
    return df


def _empty_oc_df() -> pd.DataFrame:
    return pd.DataFrame(columns=[
        "title", "title_key", "critic_score", "user_score",
        "oc_confidence", "oc_matched_title",
    ])
