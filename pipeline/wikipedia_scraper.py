import json
import logging
import re
from pathlib import Path
from typing import Optional

import requests
import pandas as pd
from bs4 import BeautifulSoup, Tag

from pipeline.config import WIKI_CACHE_PATH
from pipeline.utils import normalize_title

logger = logging.getLogger(__name__)

WIKIPEDIA_PAGES = {
    "Square Enix": "List of Square Enix video games",
    "Squaresoft": "List of games developed by Square",
    "Enix": "List of Enix games",
}

MEDIAWIKI_API = "https://en.wikipedia.org/w/api.php"

# Heuristic header keywords for column detection
_TITLE_KEYS = {"title", "game", "name", "games"}
_PLATFORM_KEYS = {"platform", "console", "system", "systems", "platforms"}
_YEAR_KEYS = {"year", "date", "release", "released", "released date", "release date"}
_DEVELOPER_KEYS = {"developer", "developers", "studio", "developed by"}
_SERIES_KEYS = {"series", "franchise"}
_REGION_KEYS = {"region", "regions", "territory", "territories"}


_HEADERS = {
    "User-Agent": (
        "SquareEnixDataViz/1.0 "
        "(personal data visualization project; torien.mitchell@bison.howard.edu)"
    )
}


def fetch_wikipedia_page_html(page_title: str) -> Optional[str]:
    params = {
        "action": "parse",
        "page": page_title,
        "prop": "text",
        "format": "json",
        "redirects": 1,
    }
    try:
        resp = requests.get(MEDIAWIKI_API, params=params, headers=_HEADERS, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        if "parse" not in data:
            logger.warning("Wikipedia: page not found — %r", page_title)
            return None
        return data["parse"]["text"]["*"]
    except requests.RequestException as exc:
        logger.warning("Wikipedia fetch failed for %r: %s", page_title, exc)
        return None


def _header_type(text: str) -> Optional[str]:
    low = text.lower().strip()
    if any(k in low for k in _TITLE_KEYS):
        return "title"
    if any(k in low for k in _PLATFORM_KEYS):
        return "platform"
    if any(k in low for k in _YEAR_KEYS):
        return "release_year"
    if any(k in low for k in _DEVELOPER_KEYS):
        return "developer"
    if any(k in low for k in _SERIES_KEYS):
        return "series"
    if any(k in low for k in _REGION_KEYS):
        return "region"
    return None


def _cell_text(cell: Tag) -> str:
    return cell.get_text(separator=" ", strip=True)


def parse_game_tables(html: str, company_era: str) -> list[dict]:
    """Parse wikitable elements, handling rowspan cells."""
    soup = BeautifulSoup(html, "lxml")
    results: list[dict] = []

    for table in soup.find_all("table", class_=re.compile(r"wikitable")):
        # Build column type map from header row(s)
        col_types: list[Optional[str]] = []
        header_rows = table.find_all("tr")
        if not header_rows:
            continue

        header_row = header_rows[0]
        headers = header_row.find_all(["th", "td"])
        for h in headers:
            col_types.append(_header_type(_cell_text(h)))

        if "title" not in [c for c in col_types if c]:
            continue  # not a game listing table

        # Process data rows with rowspan carry-forward
        # rowspan_carry: {col_index: (remaining_rows, value)}
        rowspan_carry: dict[int, list] = {}
        for row in header_rows[1:]:
            cells = row.find_all(["td", "th"])
            if not cells:
                continue

            # Build full row by inserting carry-forward values
            full_row: list[str] = []
            cell_iter = iter(cells)
            for col_idx in range(len(col_types)):
                if col_idx in rowspan_carry:
                    val, remaining = rowspan_carry[col_idx]
                    full_row.append(val)
                    if remaining > 1:
                        rowspan_carry[col_idx] = [val, remaining - 1]
                    else:
                        del rowspan_carry[col_idx]
                else:
                    cell = next(cell_iter, None)
                    if cell is None:
                        full_row.append("")
                        continue
                    text = _cell_text(cell)
                    full_row.append(text)
                    rs = int(cell.get("rowspan", 1))
                    if rs > 1:
                        rowspan_carry[col_idx] = [text, rs]

            record: dict = {"company_era": company_era, "source": "wikipedia"}
            for col_idx, col_type in enumerate(col_types):
                if col_type and col_idx < len(full_row):
                    val = full_row[col_idx]
                    if col_type not in record or not record[col_type]:
                        record[col_type] = val

            # Only keep rows that have at least a title
            if record.get("title"):
                # Clean up year: extract 4-digit year from messy strings
                if "release_year" in record:
                    m = re.search(r"\b(1\d{3}|20\d{2})\b", record["release_year"])
                    record["release_year"] = m.group(1) if m else None
                record["title_key"] = normalize_title(record["title"])
                results.append(record)

    logger.info("Wikipedia parsed %d game rows for era=%s", len(results), company_era)
    return results


def load_or_fetch_wikipedia(force_refresh: bool = False) -> list[dict]:
    if WIKI_CACHE_PATH.exists() and not force_refresh:
        logger.info("Loading Wikipedia data from cache: %s", WIKI_CACHE_PATH)
        with WIKI_CACHE_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)

    all_records: list[dict] = []
    for era, page_title in WIKIPEDIA_PAGES.items():
        logger.info("Fetching Wikipedia page: %s", page_title)
        html = fetch_wikipedia_page_html(page_title)
        if html:
            records = parse_game_tables(html, era)
            all_records.extend(records)
        else:
            logger.warning("Skipping Wikipedia era=%s — fetch failed", era)

    if not all_records:
        logger.error("All Wikipedia fetches failed. Continuing without Wikipedia data.")
        return []

    WIKI_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with WIKI_CACHE_PATH.open("w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)
    logger.info("Wikipedia cache saved (%d records)", len(all_records))
    return all_records


def fetch_wikipedia_data(force_refresh: bool = False) -> pd.DataFrame:
    records = load_or_fetch_wikipedia(force_refresh=force_refresh)
    if not records:
        return _empty_wiki_df()

    df = pd.DataFrame(records)
    # Deduplicate on (title_key, platform) — keep first occurrence per era
    if "platform" in df.columns:
        df = df.drop_duplicates(subset=["title_key", "platform"], keep="first")
    else:
        df["platform"] = None
    logger.info("Wikipedia data: %d rows after dedup", len(df))
    return df


def _empty_wiki_df() -> pd.DataFrame:
    return pd.DataFrame(columns=[
        "title", "title_key", "platform", "release_year",
        "developer", "series", "region", "company_era", "source",
    ])
