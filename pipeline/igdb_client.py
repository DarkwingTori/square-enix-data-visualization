import logging
import os
from pathlib import Path
from typing import Optional

import pandas as pd
import requests

from pipeline.config import IGDB_BASE_URL, IGDB_AUTH_URL, IGDB_COMPANY_IDS, IGDB_RAW_PATH
from pipeline.utils import normalize_title, retry

logger = logging.getLogger(__name__)

# Module-level caches to avoid redundant API calls within a session
_genre_cache: dict[int, str] = {}
_platform_cache: dict[int, str] = {}
_token: Optional[str] = None


def check_igdb_credentials() -> tuple[Optional[str], Optional[str]]:
    client_id = os.environ.get("IGDB_CLIENT_ID")
    client_secret = os.environ.get("IGDB_CLIENT_SECRET")
    if not client_id or not client_secret:
        logger.warning(
            "IGDB credentials not found. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET "
            "in your .env file. Skipping IGDB enrichment."
        )
        return None, None
    return client_id, client_secret


def get_igdb_token(client_id: str, client_secret: str) -> Optional[str]:
    try:
        resp = requests.post(
            IGDB_AUTH_URL,
            params={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "client_credentials",
            },
            timeout=15,
        )
        resp.raise_for_status()
        token = resp.json().get("access_token")
        if not token:
            logger.error("IGDB auth succeeded but no access_token in response")
            return None
        logger.info("IGDB token acquired")
        return token
    except requests.RequestException as exc:
        logger.error("IGDB token acquisition failed: %s", exc)
        return None


def _igdb_headers(token: str, client_id: str) -> dict:
    return {
        "Client-ID": client_id,
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }


@retry(max_attempts=3)
def igdb_post(endpoint: str, body: str, token: str, client_id: str) -> list[dict]:
    url = f"{IGDB_BASE_URL}/{endpoint}"
    resp = requests.post(url, data=body, headers=_igdb_headers(token, client_id), timeout=20)
    resp.raise_for_status()
    return resp.json()


def resolve_genres(genre_ids: list[int], token: str, client_id: str) -> list[str]:
    missing = [gid for gid in genre_ids if gid not in _genre_cache]
    if missing:
        body = f"fields id,name; where id = ({','.join(str(i) for i in missing)}); limit 50;"
        try:
            results = igdb_post("genres", body, token, client_id)
            for item in results:
                _genre_cache[item["id"]] = item["name"]
        except requests.RequestException:
            pass
    return [_genre_cache.get(gid, str(gid)) for gid in genre_ids]


def resolve_platforms(platform_ids: list[int], token: str, client_id: str) -> list[str]:
    missing = [pid for pid in platform_ids if pid not in _platform_cache]
    if missing:
        body = f"fields id,name; where id = ({','.join(str(i) for i in missing)}); limit 50;"
        try:
            results = igdb_post("platforms", body, token, client_id)
            for item in results:
                _platform_cache[item["id"]] = item["name"]
        except requests.RequestException:
            pass
    return [_platform_cache.get(pid, str(pid)) for pid in platform_ids]


def fetch_company_games(
    company_id: int,
    company_name: str,
    token: str,
    client_id: str,
) -> list[dict]:
    """Paginate through all games published by this company."""
    all_games: list[dict] = []
    offset = 0
    batch_size = 500

    while True:
        body = (
            f"fields name,genres,platforms,first_release_date,involved_companies; "
            f"where involved_companies.company = {company_id} & "
            f"involved_companies.publisher = true; "
            f"limit {batch_size}; offset {offset};"
        )
        try:
            batch = igdb_post("games", body, token, client_id)
        except requests.RequestException as exc:
            logger.error("IGDB fetch failed for company %s at offset %d: %s", company_name, offset, exc)
            break

        if not batch:
            break
        all_games.extend(batch)
        logger.debug("IGDB %s: fetched %d games (offset %d)", company_name, len(batch), offset)
        if len(batch) < batch_size:
            break
        offset += batch_size

    logger.info("IGDB %s: %d total games retrieved", company_name, len(all_games))
    return all_games


def parse_igdb_games(raw_games: list[dict], token: str, client_id: str) -> pd.DataFrame:
    """Explode each game by platform; resolve genre and platform IDs to names."""
    rows: list[dict] = []
    for game in raw_games:
        title = game.get("name", "")
        igdb_id = game.get("id")
        genre_ids = game.get("genres", [])
        platform_ids = game.get("platforms", [])
        release_ts = game.get("first_release_date")
        release_year = None
        if release_ts:
            from datetime import datetime, timezone
            release_year = datetime.fromtimestamp(release_ts, tz=timezone.utc).year

        genre_names = resolve_genres(genre_ids, token, client_id)
        platform_names = resolve_platforms(platform_ids, token, client_id)

        genre = genre_names[0] if genre_names else None
        subgenre = genre_names[1] if len(genre_names) > 1 else None

        if platform_names:
            for plat in platform_names:
                rows.append({
                    "title": title,
                    "igdb_id": igdb_id,
                    "genre": genre,
                    "subgenre": subgenre,
                    "platform": plat,
                    "release_year": release_year,
                    "source": "igdb",
                })
        else:
            rows.append({
                "title": title,
                "igdb_id": igdb_id,
                "genre": genre,
                "subgenre": subgenre,
                "platform": None,
                "release_year": release_year,
                "source": "igdb",
            })

    df = pd.DataFrame(rows)
    if not df.empty:
        df["title_key"] = df["title"].apply(normalize_title)
    return df


def verify_company_ids(token: str, client_id: str) -> None:
    """Print confirmed IGDB IDs for Square/Enix companies. Run once to verify config."""
    for name in ["Square", "Squaresoft", "Enix", "Square Enix"]:
        body = f'search "{name}"; fields id,name,country; limit 5;'
        try:
            results = igdb_post("companies", body, token, client_id)
            logger.info("IGDB company search %r: %s", name, results)
        except requests.RequestException as exc:
            logger.error("Company search failed for %r: %s", name, exc)


def fetch_all_igdb(token: str, client_id: str) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for company_name, company_id in IGDB_COMPANY_IDS.items():
        raw = fetch_company_games(company_id, company_name, token, client_id)
        if raw:
            df = parse_igdb_games(raw, token, client_id)
            frames.append(df)

    if not frames:
        return _empty_igdb_df()

    combined = pd.concat(frames, ignore_index=True)
    # Deduplicate: same igdb_id + platform may appear under multiple companies
    combined = combined.drop_duplicates(subset=["igdb_id", "platform"])
    logger.info("IGDB total: %d rows after dedup", len(combined))
    return combined


def fetch_igdb_data(raw_dir: Path) -> pd.DataFrame:
    # Use cached intermediate if it exists
    if IGDB_RAW_PATH.exists():
        logger.info("Loading IGDB data from cache: %s", IGDB_RAW_PATH)
        return pd.read_csv(IGDB_RAW_PATH, low_memory=False)

    client_id, client_secret = check_igdb_credentials()
    if not client_id:
        return _empty_igdb_df()

    token = get_igdb_token(client_id, client_secret)
    if not token:
        return _empty_igdb_df()

    df = fetch_all_igdb(token, client_id)
    if not df.empty:
        IGDB_RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(IGDB_RAW_PATH, index=False)
        logger.info("IGDB intermediate saved: %s", IGDB_RAW_PATH)
    return df


def _empty_igdb_df() -> pd.DataFrame:
    return pd.DataFrame(columns=[
        "title", "title_key", "igdb_id", "genre", "subgenre",
        "platform", "release_year", "source",
    ])
