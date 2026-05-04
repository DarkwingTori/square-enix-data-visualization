import logging
import re
from typing import Optional

import pandas as pd

from pipeline.config import (
    PLATFORM_MAP,
    PLATFORM_FAMILY_MAP,
    PLATFORM_TYPE_MAP,
    DIMENSION_LOOKUP,
    JAPAN_ONLY_TITLES,
    get_company_era,
    get_nintendo_relationship_era,
)
from pipeline.utils import normalize_title

logger = logging.getLogger(__name__)

_YEAR_PATTERNS = [
    re.compile(r"^(\d{4})$"),                   # "1997"
    re.compile(r"^(\d{4})-\d{2}-\d{2}$"),       # "1997-01-31"
    re.compile(r"^\w+ (\d{4})$"),                # "January 1997"
    re.compile(r"^(\d{4})\?$"),                  # "199?"  — treated as NaN
]


def normalize_platform(raw: str) -> str:
    cleaned = str(raw).strip()
    result = PLATFORM_MAP.get(cleaned)
    if result:
        return result
    # Try title-case variant
    result = PLATFORM_MAP.get(cleaned.title())
    if result:
        return result
    logger.debug("Unknown platform string: %r — keeping as-is", cleaned)
    return cleaned


def apply_platform_normalization(df: pd.DataFrame) -> pd.DataFrame:
    if "platform" not in df.columns:
        return df
    df = df.copy()
    df["platform"] = df["platform"].apply(normalize_platform)
    df["platform_family"] = df["platform"].map(PLATFORM_FAMILY_MAP).fillna("Other")
    df["platform_type"] = df["platform"].map(PLATFORM_TYPE_MAP).fillna("Other")
    return df


def assign_company_era(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    year_col = df.get("release_year", pd.Series(0, index=df.index))

    def _derive(row) -> str:
        publisher = row.get("publisher", "")
        year = _safe_int(row.get("release_year", 0))
        return get_company_era(publisher, year)

    derived = df.apply(_derive, axis=1)
    if "company_era" in df.columns:
        # Prefer existing value; fill blanks with derived
        df["company_era"] = df["company_era"].where(
            df["company_era"].notna() & (df["company_era"] != ""),
            derived,
        )
    else:
        df["company_era"] = derived
    return df


def assign_nintendo_era(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    def _era(row) -> str:
        year = _safe_int(row.get("release_year", 0))
        family = row.get("platform_family", "")
        return get_nintendo_relationship_era(year, family)

    df["nintendo_relationship_era"] = df.apply(_era, axis=1)
    return df


def assign_dimension(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    def _dim(title: str) -> str:
        # Exact match first
        if title in DIMENSION_LOOKUP:
            return DIMENSION_LOOKUP[title]
        # Prefix match for series entries (e.g. "Final Fantasy" key covers subtitled variants)
        for key, val in DIMENSION_LOOKUP.items():
            if title.lower().startswith(key.lower() + " ") or title.lower().startswith(key.lower() + ":"):
                return val
        return "Unknown"

    if "dimension" not in df.columns:
        df["dimension"] = df["title"].apply(_dim)
    else:
        mask = df["dimension"].isna() | (df["dimension"] == "")
        df.loc[mask, "dimension"] = df.loc[mask, "title"].apply(_dim)
    return df


def flag_japan_only(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "japan_only" not in df.columns:
        df["japan_only"] = False

    # Titles in the manual set
    manual_mask = df["title"].isin(JAPAN_ONLY_TITLES)

    # Titles where only JP region rows exist (no NA or EU rows with non-zero sales)
    if "region" in df.columns and "sales" in df.columns:
        title_regions = df[df["sales"].fillna(0) > 0].groupby("title")["region"].apply(set)
        jp_only_titles = title_regions[
            title_regions.apply(lambda r: r == {"JP"} or r == {"JP", "Other"})
        ].index
        region_mask = df["title"].isin(jp_only_titles)
    else:
        region_mask = pd.Series(False, index=df.index)

    df["japan_only"] = df["japan_only"] | manual_mask | region_mask
    return df


def normalize_title_column(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["title_key"] = df["title"].apply(normalize_title)
    return df


def clean_release_year(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "release_year" not in df.columns:
        df["release_year"] = pd.NA
        return df

    def _parse_year(val) -> Optional[int]:
        if pd.isna(val):
            return None
        s = str(val).strip()
        if re.match(r"^\d{4}$", s):
            y = int(s)
            return y if 1970 <= y <= 2030 else None
        m = re.match(r"^(\d{4})-\d{2}-\d{2}$", s)
        if m:
            return int(m.group(1))
        m = re.match(r"^\w+ (\d{4})$", s)
        if m:
            return int(m.group(1))
        return None

    df["release_year"] = df["release_year"].apply(_parse_year)
    df["release_year"] = pd.to_numeric(df["release_year"], errors="coerce").astype("Int64")
    return df


def run_all_normalizations(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    df = clean_release_year(df)
    df = apply_platform_normalization(df)
    df = assign_company_era(df)
    df = assign_nintendo_era(df)
    df = assign_dimension(df)
    df = flag_japan_only(df)
    df = normalize_title_column(df)
    return df


def _safe_int(val, default: int = 0) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return default
