import logging
import glob
from pathlib import Path
from typing import Optional

import pandas as pd

from pipeline.config import SQUARE_PUBLISHER_PATTERNS
from pipeline.utils import normalize_title

logger = logging.getLogger(__name__)

# Maps canonical field names to known column name variants across dataset versions
COLUMN_ALIASES: dict[str, list[str]] = {
    "title": ["Name", "name", "Game", "game", "Title", "title", "game_name"],
    "platform": ["Platform", "platform", "Console", "console"],
    "release_year": [
        "Year", "year", "Year_of_Release", "release_year",
        "Year of Release", "YearOfRelease",
    ],
    "genre": ["Genre", "genre", "Category", "category"],
    "publisher": ["Publisher", "publisher", "Published_By"],
    "na_sales": ["NA_Sales", "NA Sales", "na_sales", "North America", "NA"],
    "eu_sales": ["EU_Sales", "EU Sales", "eu_sales", "Europe", "EU", "PAL_Sales"],
    "jp_sales": ["JP_Sales", "JP Sales", "jp_sales", "Japan", "JP"],
    "other_sales": ["Other_Sales", "Other Sales", "other_sales", "Other", "Rest"],
    "global_sales": [
        "Global_Sales", "Global Sales", "global_sales", "Total", "World_Sales",
    ],
}

REGION_LABELS = {
    "na_sales": "NA",
    "eu_sales": "EU",
    "jp_sales": "JP",
    "other_sales": "Other",
}


def find_kaggle_csv(raw_dir: Path) -> Path:
    csv_files = list(raw_dir.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(
            f"No CSV files found in {raw_dir}. "
            "Download a VGChartz dataset from Kaggle and place it there."
        )
    preferred_keywords = ["vgsales", "vgchartz", "games", "video"]
    for keyword in preferred_keywords:
        for f in csv_files:
            if keyword in f.name.lower():
                logger.info("Using Kaggle CSV: %s", f.name)
                return f
    logger.info("Using Kaggle CSV: %s", csv_files[0].name)
    return csv_files[0]


def detect_columns(df: pd.DataFrame) -> dict[str, str]:
    """Map canonical field names to actual column names in df."""
    mapping: dict[str, str] = {}
    missing: list[str] = []
    for canonical, aliases in COLUMN_ALIASES.items():
        found = next((a for a in aliases if a in df.columns), None)
        if found:
            mapping[canonical] = found
        else:
            # global_sales and other_sales are derived if absent — not fatal
            if canonical not in ("global_sales", "other_sales"):
                missing.append(canonical)
    if missing:
        raise ValueError(
            f"Could not detect columns for: {missing}. "
            f"Available columns: {list(df.columns)}"
        )
    return mapping


def _is_square_publisher(publisher: str) -> bool:
    pub = str(publisher).lower().strip()
    return any(p in pub for p in SQUARE_PUBLISHER_PATTERNS)


def load_kaggle_csv(raw_dir: Path) -> pd.DataFrame:
    csv_path = find_kaggle_csv(raw_dir)
    df = pd.read_csv(csv_path, low_memory=False)
    logger.info("Loaded %d rows from %s", len(df), csv_path.name)

    col_map = detect_columns(df)
    df = df.rename(columns={v: k for k, v in col_map.items()})

    # Filter to Square/Enix publishers only
    df = df[df["publisher"].apply(_is_square_publisher)].copy()
    logger.info("%d rows after Square/Enix publisher filter", len(df))

    if df.empty:
        logger.warning(
            "No Square/Enix rows found. Check that publisher column contains "
            "'Square', 'Squaresoft', 'Enix', or 'Square Enix'."
        )
        return _empty_kaggle_df()

    # Derive global_sales if missing
    sales_cols = ["na_sales", "eu_sales", "jp_sales", "other_sales"]
    present_sales = [c for c in sales_cols if c in df.columns]
    if "global_sales" not in df.columns and present_sales:
        df["global_sales"] = df[present_sales].apply(
            pd.to_numeric, errors="coerce"
        ).sum(axis=1)

    df = _melt_regional_sales(df)
    df["source"] = "kaggle"
    df["title_key"] = df["title"].apply(normalize_title)

    logger.info("Kaggle loader produced %d rows (long format)", len(df))
    return df


def _melt_regional_sales(df: pd.DataFrame) -> pd.DataFrame:
    """Convert wide regional sales to long format (one row per title+platform+region)."""
    id_cols = [c for c in ["title", "platform", "release_year", "genre", "publisher"]
               if c in df.columns]
    region_cols = {k: v for k, v in REGION_LABELS.items() if k in df.columns}

    if not region_cols:
        # Fall back to global_sales only, label region as "Global"
        df["sales"] = pd.to_numeric(df.get("global_sales", pd.Series()), errors="coerce")
        df["region"] = "Global"
        df["sales_missing"] = df["sales"].isna() | (df["sales"] == 0)
        return df[id_cols + ["region", "sales", "sales_missing"]]

    # Coerce all sales columns to numeric
    for col in region_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    melted = df[id_cols + list(region_cols.keys())].melt(
        id_vars=id_cols,
        value_vars=list(region_cols.keys()),
        var_name="region_col",
        value_name="sales",
    )
    melted["region"] = melted["region_col"].map(region_cols)
    melted = melted.drop(columns=["region_col"])
    melted["sales_missing"] = melted["sales"].isna() | (melted["sales"] == 0)

    # Drop rows where all regions are zero/missing for a given title+platform
    # (keeps the structure but marks them)
    return melted.reset_index(drop=True)


def _empty_kaggle_df() -> pd.DataFrame:
    return pd.DataFrame(columns=[
        "title", "platform", "release_year", "genre", "publisher",
        "region", "sales", "sales_missing", "source", "title_key",
    ])
