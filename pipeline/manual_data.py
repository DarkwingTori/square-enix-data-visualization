"""
Enrichment from manually curated data files in the project root.

Reads:
  salesdata.md  — franchise-level sales, top-50 game sales, revenue estimates
  gamegenre.md  — per-game genre/subgenre overrides (when populated)

Provides:
  enrich_from_manual_data(df) -> df
"""
import logging
import re
from pathlib import Path

import pandas as pd

from pipeline.config import ROOT
from pipeline.utils import normalize_title

logger = logging.getLogger(__name__)

SALESDATA_PATH = ROOT / "salesdata.md"
GAMEGENRE_PATH = ROOT / "gamegenre.md"

# ---------------------------------------------------------------------------
# Franchise → series name mapping
# Keys are keyword patterns (lowercase); values are canonical series names.
# Order matters: more specific patterns first.
# ---------------------------------------------------------------------------
FRANCHISE_PATTERNS: list[tuple[str, str]] = [
    ("final fantasy tactics", "Final Fantasy Tactics"),
    ("final fantasy crystal chronicles", "Final Fantasy Crystal Chronicles"),
    ("final fantasy", "Final Fantasy"),
    ("dragon quest monsters", "Dragon Quest Monsters"),
    ("dragon quest builders", "Dragon Quest Builders"),
    ("dragon quest", "Dragon Quest"),
    ("dragon warrior", "Dragon Quest"),
    ("kingdom hearts", "Kingdom Hearts"),
    ("tomb raider", "Tomb Raider"),
    ("just cause", "Just Cause"),
    ("hitman", "Hitman"),
    ("nier", "Drakengard / Nier"),
    ("drakengard", "Drakengard / Nier"),
    ("secret of mana", "Mana"),
    ("seiken densetsu", "Mana"),
    ("trials of mana", "Mana"),
    ("legend of mana", "Mana"),
    ("children of mana", "Mana"),
    ("dawn of mana", "Mana"),
    ("adventures of mana", "Mana"),
    ("saga frontier", "SaGa"),
    ("saga scarlet", "SaGa"),
    ("romancing saga", "SaGa"),
    ("final fantasy legend", "SaGa"),
    ("saga", "SaGa"),
    ("space invaders", "Space Invaders"),
    ("chrono trigger", "Chrono"),
    ("chrono cross", "Chrono"),
    ("radical dreamers", "Chrono"),
    ("star ocean", "Star Ocean"),
    ("octopath traveler", "Octopath Traveler"),
    ("front mission", "Front Mission"),
    ("bravely default", "Bravely"),
    ("bravely second", "Bravely"),
    ("legacy of kain", "Legacy of Kain"),
    ("blood omen", "Legacy of Kain"),
    ("soul reaver", "Legacy of Kain"),
    ("nosgoth", "Legacy of Kain"),
    ("chocobo", "Chocobo"),
    ("parasite eve", "Parasite Eve"),
    ("life is strange", "Life Is Strange"),
    ("outriders", "Outriders"),
    ("bubble bobble", "Bubble Bobble"),
    ("valkyrie profile", "Valkyrie Profile"),
    ("valkyrie elysium", "Valkyrie Profile"),
    ("valkyrie anatomia", "Valkyrie Profile"),
    ("tactics ogre", "Ogre"),
    ("ogre battle", "Ogre"),
    ("xenogears", "Xenogears"),
    ("brave fencer musashi", "Musashi"),
    ("musashi samurai legend", "Musashi"),
    ("soul blazer", "Soul Blazer"),
    ("illusion of gaia", "Soul Blazer"),
    ("terranigma", "Soul Blazer"),
    ("chaos rings", "Chaos Rings"),
    ("dissidia", "Final Fantasy"),
    ("crisis core", "Final Fantasy"),
    ("dirge of cerberus", "Final Fantasy"),
    ("stranger of paradise", "Final Fantasy"),
    ("war of the visions", "Final Fantasy"),
    ("world of final fantasy", "Final Fantasy"),
    ("forspoken", "Standalone"),
    ("sleeping dogs", "Standalone"),
    ("deus ex", "Deus Ex"),
    ("thief", "Thief"),
    ("marvel", "Marvel"),
    ("avengers", "Marvel"),
    ("guardians of the galaxy", "Marvel"),
    ("dragon quest walk", "Dragon Quest"),
    ("dragon quest x", "Dragon Quest"),
    ("triangle strategy", "Standalone"),
    ("live a live", "Standalone"),
    ("octopath", "Octopath Traveler"),
    ("the diofield chronicle", "Standalone"),
    ("harvestella", "Standalone"),
    ("babylon's fall", "Standalone"),
]


def assign_series_from_patterns(title) -> str:
    """Return the series name for a title, or 'Standalone' if no pattern matches."""
    if not title or not isinstance(title, str):
        return "Standalone"
    t = title.lower()
    for pattern, series in FRANCHISE_PATTERNS:
        if pattern in t:
            return series
    return "Standalone"


# ---------------------------------------------------------------------------
# Parse best-selling games table from salesdata.md
# Returns: {normalized_title: sales_in_millions}
# ---------------------------------------------------------------------------
def _parse_bestselling_sales(path: Path) -> dict[str, float]:
    if not path.exists():
        return {}

    text = path.read_text(encoding="utf-8")

    # Find the best-selling games table section
    section_start = text.find("Best-selling games")
    section_end = text.find("Gross revenue", section_start)
    if section_start == -1:
        return {}
    section = text[section_start:section_end if section_end != -1 else None]

    # Match table rows: rank (optional) TAB title TAB year TAB platform(s) TAB sales
    row_pattern = re.compile(
        r"^\d*\t(.+?)\t(\d{4})\t.+?\t([\d,+]+)",
        re.MULTILINE,
    )

    lookup: dict[str, float] = {}
    for m in row_pattern.finditer(section):
        raw_title = m.group(1).strip()
        raw_sales = m.group(3).replace(",", "").replace("+", "").strip()
        try:
            sales_units = int(raw_sales)
            # salesdata.md gives raw unit numbers (e.g. 24000000) not millions
            sales_m = round(sales_units / 1_000_000, 3)
            key = normalize_title(raw_title)
            lookup[key] = sales_m
        except ValueError:
            continue

    logger.info("salesdata.md: parsed %d best-selling game entries", len(lookup))
    return lookup


# ---------------------------------------------------------------------------
# Parse revenue table from salesdata.md
# Returns: {normalized_title: revenue_usd_string}
# ---------------------------------------------------------------------------
def _parse_revenue(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    text = path.read_text(encoding="utf-8")
    section_start = text.find("Gross revenue")
    section_end = text.find("Platforms", section_start)
    if section_start == -1:
        return {}
    section = text[section_start:section_end if section_end != -1 else None]

    row_pattern = re.compile(
        r"^\d+\t(.+?)\t(\d{4})\t(\$[\d,]+)",
        re.MULTILINE,
    )

    lookup: dict[str, str] = {}
    for m in row_pattern.finditer(section):
        raw_title = m.group(1).strip()
        revenue = m.group(3).strip()
        lookup[normalize_title(raw_title)] = revenue

    logger.info("salesdata.md: parsed %d revenue entries", len(lookup))
    return lookup


# ---------------------------------------------------------------------------
# Parse gamegenre.md for genre/subgenre overrides
# Expected format: tab-separated rows with title, genre, subgenre columns
# ---------------------------------------------------------------------------
def _parse_gamegenre(path: Path) -> dict[str, dict]:
    if not path.exists() or path.stat().st_size == 0:
        return {}

    text = path.read_text(encoding="utf-8")
    overrides: dict[str, dict] = {}

    for line in text.splitlines():
        parts = [p.strip() for p in line.split("\t")]
        if len(parts) < 2 or parts[0].lower() in ("title", "game", ""):
            continue
        title_key = normalize_title(parts[0])
        overrides[title_key] = {
            "genre": parts[1] if len(parts) > 1 else None,
            "subgenre": parts[2] if len(parts) > 2 else None,
        }

    logger.info("gamegenre.md: loaded %d genre overrides", len(overrides))
    return overrides


# ---------------------------------------------------------------------------
# Main enrichment function
# ---------------------------------------------------------------------------
def enrich_from_manual_data(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # --- 1. Series column ---
    if "series" not in df.columns or df["series"].isna().all():
        df["series"] = df["title"].apply(assign_series_from_patterns)
    else:
        mask = df["series"].isna() | (df["series"] == "")
        df.loc[mask, "series"] = df.loc[mask, "title"].apply(assign_series_from_patterns)

    series_filled = (df["series"].notna() & (df["series"] != "")).sum()
    logger.info("series column: %d/%d rows filled", series_filled, len(df))

    # --- 2. Sales from best-selling table (fill gaps only) ---
    bestselling = _parse_bestselling_sales(SALESDATA_PATH)
    if bestselling and "sales" in df.columns and "title_key" in df.columns:
        missing_mask = df["sales"].isna() | (df["sales"] == 0)
        filled = 0
        for idx in df[missing_mask].index:
            key = df.at[idx, "title_key"]
            if key in bestselling:
                df.at[idx, "sales"] = bestselling[key]
                df.at[idx, "sales_missing"] = False
                filled += 1
        logger.info("salesdata.md: filled %d missing sales values", filled)

    # --- 3. Revenue column ---
    revenue = _parse_revenue(SALESDATA_PATH)
    if revenue and "title_key" in df.columns:
        df["gross_revenue"] = df["title_key"].map(revenue)

    # --- 4. Genre overrides from gamegenre.md ---
    genre_overrides = _parse_gamegenre(GAMEGENRE_PATH)
    if genre_overrides and "title_key" in df.columns:
        for idx, row in df.iterrows():
            key = row.get("title_key")
            if key in genre_overrides:
                override = genre_overrides[key]
                if override.get("genre") and (pd.isna(row.get("genre")) or row.get("genre") == ""):
                    df.at[idx, "genre"] = override["genre"]
                if override.get("subgenre") and (pd.isna(row.get("subgenre")) or row.get("subgenre") == ""):
                    df.at[idx, "subgenre"] = override["subgenre"]

    return df
