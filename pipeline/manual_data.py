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
# Supplement for series absent from or missing subgenre in gamegenre.md.
# Keys are normalized series names (match what normalize_title() produces).
# Values use None to mean "keep whatever gamegenre.md already assigned".
# ---------------------------------------------------------------------------
_SERIES_GENRE_SUPPLEMENT: dict[str, dict] = {
    # Eidos titles — not in gamegenre.md
    "tomb raider":      {"genre": "Action-Adventure",  "subgenre": "Third-Person Action / Platformer"},
    "deus ex":          {"genre": "Action-Adventure",  "subgenre": "First-Person RPG / Immersive Sim"},
    "hitman":           {"genre": "Action",             "subgenre": "Stealth / Third-Person"},
    "thief":            {"genre": "Action-Adventure",  "subgenre": "Stealth / First-Person"},
    "legacy of kain":   {"genre": "Action-Adventure",  "subgenre": "Hack-and-Slash / Dark Fantasy"},
    "soul blazer":      {"genre": "Action RPG",        "subgenre": "Top-Down / God Game Hybrid"},
    "xenogears":        {"genre": "RPG",               "subgenre": "Turn-Based RPG / Mecha"},
    "marvel":           {"genre": "Action",             "subgenre": "Brawler / Third-Person Action"},
    "outriders":        {"genre": "Shooter",           "subgenre": "Third-Person Shooter / Action RPG"},
    # Present in gamegenre.md but subgenre block missing
    "life is strange":  {"genre": None,                "subgenre": "Graphic Adventure / Narrative Choice"},
    "chaos rings":      {"genre": None,                "subgenre": "Turn-Based RPG / Mobile"},
}


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
    """
    Parse franchise-organized markdown in gamegenre.md.
    Returns {normalized_series_name: {genre, subgenre}}.
    """
    if not path.exists() or path.stat().st_size == 0:
        return {}

    text = path.read_text(encoding="utf-8")
    overrides: dict[str, dict] = {}

    current_genre: str | None = None
    current_subgenre: str | None = None

    _emoji_re = re.compile(r"[^\x00-\x7F -~]+")
    _paren_re = re.compile(r"\s*\(.*?\)")

    for line in text.splitlines():
        stripped = line.strip()

        # ## Genre header
        if stripped.startswith("## "):
            raw = stripped[3:].strip()
            raw = _emoji_re.sub("", raw).strip()
            # Prefer short label in parens, e.g. "Role-Playing Games (RPG)" → "RPG"
            paren_match = re.search(r"\(([^)]+)\)", raw)
            current_genre = paren_match.group(1).strip() if paren_match else raw
            current_subgenre = None
            continue

        # **Subgenre** bold block
        if stripped.startswith("**") and stripped.endswith("**"):
            current_subgenre = stripped[2:-2].strip()
            continue

        # - Franchise bullet
        if stripped.startswith("- ") and current_genre:
            raw_name = stripped[2:].strip()
            # Remove parenthetical notes: "Final Fantasy (I–XVI + spin-offs)" → "Final Fantasy"
            name = _paren_re.sub("", raw_name).strip()
            # Strip trailing " series" / " Series"
            name = re.sub(r"\s+[Ss]eries$", "", name).strip()
            # Strip trailing " / ..." variants like "Nier / Nier: Automata / Nier Replicant"
            # Take only the first slash-separated part if present
            name = name.split(" / ")[0].strip()

            key = normalize_title(name)
            if key and key not in overrides:
                overrides[key] = {
                    "genre": current_genre,
                    "subgenre": current_subgenre,
                }

    # Merge supplement: add missing series; fill None genre/subgenre on existing entries
    for key, sup in _SERIES_GENRE_SUPPLEMENT.items():
        if key not in overrides:
            overrides[key] = sup
        else:
            existing = overrides[key]
            if sup.get("genre") and not existing.get("genre"):
                existing["genre"] = sup["genre"]
            if sup.get("subgenre") and not existing.get("subgenre"):
                existing["subgenre"] = sup["subgenre"]

    logger.info("gamegenre.md: loaded %d series genre mappings (incl. supplement)", len(overrides))
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

    # --- 4. Genre overrides from gamegenre.md (matched on series, not title) ---
    genre_map = _parse_gamegenre(GAMEGENRE_PATH)
    if genre_map and "series" in df.columns:
        for col in ("genre", "subgenre"):
            if col not in df.columns:
                df[col] = None

        # Build prefix-match cache: for each series key seen, find best genre_map key.
        # Exact match wins; else look for a genre_map key that is a prefix of series_key
        # or series_key is a prefix of a genre_map key (e.g. "bravely" → "bravely default").
        _series_cache: dict[str, dict] = {}

        def _lookup_series(series_key: str) -> dict:
            if series_key in _series_cache:
                return _series_cache[series_key]
            if series_key in genre_map:
                result = genre_map[series_key]
            else:
                result = {}
                for gk, gv in genre_map.items():
                    if series_key.startswith(gk) or gk.startswith(series_key):
                        result = gv
                        break
            _series_cache[series_key] = result
            return result

        for idx, row in df.iterrows():
            series_key = normalize_title(str(row.get("series", "") or ""))
            mapping = _lookup_series(series_key)
            if not mapping:
                continue
            if mapping.get("genre") and (pd.isna(row.get("genre")) or row.get("genre") == ""):
                df.at[idx, "genre"] = mapping["genre"]
            if mapping.get("subgenre") and (pd.isna(row.get("subgenre")) or row.get("subgenre") == ""):
                df.at[idx, "subgenre"] = mapping["subgenre"]

    return df
