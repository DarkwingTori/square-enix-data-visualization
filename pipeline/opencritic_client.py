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


def load_opencritic_csv(raw_dir: Path, master_titles: list[str]) -> pd.DataFrame:
    """
    Load an OpenCritic rankings CSV (title, score, opencritic_classification,
    platforms, release_date, url) and fuzzy-match against master_titles.
    Returns a DataFrame in the same schema as fetch_opencritic_data().
    """
    candidates = list(raw_dir.glob("opencritic*.csv"))
    if not candidates:
        return _empty_oc_df()

    path = candidates[0]
    logger.info("Loading OpenCritic CSV: %s", path.name)
    oc = pd.read_csv(path, low_memory=False)

    # Normalise column names to lowercase
    oc.columns = [c.lower().strip() for c in oc.columns]
    if "title" not in oc.columns or "score" not in oc.columns:
        logger.warning("OpenCritic CSV missing 'title' or 'score' column — skipping")
        return _empty_oc_df()

    oc["score"] = pd.to_numeric(oc["score"], errors="coerce")
    oc = oc.dropna(subset=["title", "score"])
    oc["title_key_csv"] = oc["title"].apply(normalize_title)

    # Build a lookup dict: title_key → row for fast exact matching
    csv_lookup: dict[str, dict] = {
        row["title_key_csv"]: row for _, row in oc.iterrows()
    }
    csv_title_keys = list(csv_lookup.keys())

    rows: list[dict] = []
    unmatched = 0
    for master_title in master_titles:
        key = normalize_title(master_title)

        # 1. Exact match
        if key in csv_lookup:
            matched_row = csv_lookup[key]
            confidence = 1.0
        else:
            # 2. Prefix match — CSV title starts with our query
            #    e.g. "dragon quest 11" matches "dragon quest 11 echoes of an elusive age"
            prefix_matches = [
                (ck, csv_lookup[ck]) for ck in csv_title_keys
                if ck.startswith(key + " ") or ck.startswith(key + ":")
            ]
            if prefix_matches:
                # Pick the shortest (most specific) prefix match
                prefix_matches.sort(key=lambda x: len(x[0]))
                best_csv_key, matched_row = prefix_matches[0]
                confidence = 0.92
            else:
                # 3. Fuzzy fallback
                best_key, confidence = best_fuzzy_match(key, csv_title_keys, threshold=CONFIDENCE_THRESHOLD)
                if best_key is None:
                    unmatched += 1
                    continue
                matched_row = csv_lookup[best_key]

        rows.append({
            "title": master_title,
            "title_key": key,
            "critic_score": matched_row["score"],
            "user_score": None,
            "oc_confidence": confidence,
            "oc_matched_title": matched_row["title"],
            "oc_classification": matched_row.get("opencritic_classification"),
        })

    logger.info(
        "OpenCritic CSV: %d/%d titles matched (%d unmatched)",
        len(rows), len(master_titles), unmatched,
    )
    if not rows:
        return _empty_oc_df()
    return pd.DataFrame(rows)


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
