import logging
from typing import Optional

import pandas as pd

from pipeline.config import OUTPUT_SCHEMA_COLUMNS
from pipeline.utils import normalize_title, best_fuzzy_match

logger = logging.getLogger(__name__)

FUZZY_THRESHOLD = 0.82


def build_master_title_list(
    kaggle_df: pd.DataFrame,
    igdb_df: pd.DataFrame,
    wiki_df: pd.DataFrame,
) -> pd.DataFrame:
    """Union all (title, title_key, platform) pairs. Kaggle rows are authoritative."""
    frames = []

    for df, source_name in [(kaggle_df, "kaggle"), (igdb_df, "igdb"), (wiki_df, "wikipedia")]:
        if df.empty:
            continue
        needed = ["title", "title_key"]
        if "platform" in df.columns:
            needed.append("platform")
        sub = df[needed].copy()
        if "platform" not in sub.columns:
            sub["platform"] = None
        sub["_from"] = source_name
        frames.append(sub)

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)

    # For the spine, keep one row per (title_key, platform) but record all sources
    spine = combined.groupby(["title_key", "platform"], dropna=False).agg(
        title=("title", "first"),
        _sources=("_from", lambda x: "|".join(sorted(set(x)))),
    ).reset_index()

    # Bring in full Kaggle rows (which have region, sales, etc.)
    if not kaggle_df.empty:
        master = kaggle_df.merge(
            spine[["title_key", "platform", "_sources"]],
            on=["title_key", "platform"],
            how="outer",
        )
    else:
        master = spine.copy()
        master["sales"] = None
        master["region"] = None

    master["sales_missing"] = master.get("sales_missing", pd.Series(True, index=master.index))
    if "sales" not in master.columns:
        master["sales"] = None
        master["sales_missing"] = True

    logger.info("Master spine: %d rows", len(master))
    return master


def merge_igdb_metadata(master: pd.DataFrame, igdb_df: pd.DataFrame) -> pd.DataFrame:
    if igdb_df.empty:
        logger.info("IGDB data empty — skipping enrichment")
        return master

    igdb_cols = [c for c in ["title_key", "platform", "genre", "subgenre", "developer", "igdb_id"]
                 if c in igdb_df.columns]
    igdb_slim = igdb_df[igdb_cols].drop_duplicates(subset=["title_key", "platform"])

    master = master.merge(igdb_slim, on=["title_key", "platform"], how="left", suffixes=("", "_igdb"))

    # Fill from igdb columns where master column is empty
    for col in ["genre", "subgenre", "developer"]:
        igdb_col = f"{col}_igdb"
        if igdb_col in master.columns:
            if col not in master.columns:
                master[col] = master[igdb_col]
            else:
                master[col] = master[col].where(master[col].notna(), master[igdb_col])
            master = master.drop(columns=[igdb_col])

    # Fuzzy fallback: for rows still missing genre/developer, try title-only match
    igdb_by_title = igdb_df.drop_duplicates(subset=["title_key"])
    missing_mask = master["genre"].isna() if "genre" in master.columns else pd.Series(True, index=master.index)
    if missing_mask.any():
        igdb_titles = igdb_by_title["title_key"].tolist()
        for idx in master[missing_mask].index:
            query = master.at[idx, "title_key"]
            match, score = best_fuzzy_match(query, igdb_titles, threshold=FUZZY_THRESHOLD)
            if match:
                row = igdb_by_title[igdb_by_title["title_key"] == match].iloc[0]
                for col in ["genre", "subgenre", "developer"]:
                    if col in row and pd.isna(master.at[idx, col] if col in master.columns else None):
                        master.at[idx, col] = row[col]
                master.at[idx, "match_confidence"] = score
                master.at[idx, "fuzzy_matched"] = True

    if "match_confidence" not in master.columns:
        master["match_confidence"] = 1.0
    if "fuzzy_matched" not in master.columns:
        master["fuzzy_matched"] = False

    logger.info("After IGDB merge: genre filled in %d rows",
                master["genre"].notna().sum() if "genre" in master.columns else 0)
    return master


def merge_opencritic_scores(master: pd.DataFrame, oc_df: pd.DataFrame) -> pd.DataFrame:
    if oc_df.empty:
        logger.info("OpenCritic data empty — skipping")
        return master

    oc_cols = [c for c in ["title_key", "critic_score", "user_score", "oc_confidence", "oc_matched_title"]
               if c in oc_df.columns]
    oc_slim = oc_df[oc_cols].drop_duplicates(subset=["title_key"])

    master = master.merge(oc_slim, on="title_key", how="left", suffixes=("", "_oc"))

    master["oc_low_confidence"] = master.get(
        "oc_confidence", pd.Series(1.0, index=master.index)
    ).fillna(0) < FUZZY_THRESHOLD

    logger.info("After OpenCritic merge: critic_score filled in %d rows",
                master["critic_score"].notna().sum() if "critic_score" in master.columns else 0)
    return master


def merge_wikipedia_metadata(master: pd.DataFrame, wiki_df: pd.DataFrame) -> pd.DataFrame:
    if wiki_df.empty:
        logger.info("Wikipedia data empty — skipping")
        return master

    wiki_cols = [c for c in ["title_key", "platform", "series", "company_era", "developer", "japan_only"]
                 if c in wiki_df.columns]
    wiki_slim = wiki_df[wiki_cols].drop_duplicates(subset=["title_key", "platform"])

    master = master.merge(wiki_slim, on=["title_key", "platform"], how="left", suffixes=("", "_wiki"))

    for col in ["series", "company_era", "developer", "japan_only"]:
        wiki_col = f"{col}_wiki"
        if wiki_col in master.columns:
            if col not in master.columns:
                master[col] = master[wiki_col]
            else:
                master[col] = master[col].where(
                    master[col].notna() & (master[col] != ""),
                    master[wiki_col],
                )
            master = master.drop(columns=[wiki_col])

    logger.info("After Wikipedia merge: series filled in %d rows",
                master["series"].notna().sum() if "series" in master.columns else 0)
    return master


def assign_exclusivity_status(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if "platform_family" not in df.columns or "release_year" not in df.columns:
        df["exclusivity_status"] = "Unknown"
        return df

    family_per_title = (
        df.dropna(subset=["platform_family"])
        .groupby("title_key")["platform_family"]
        .apply(set)
    )
    year_family = (
        df.dropna(subset=["platform_family", "release_year"])
        .groupby(["title_key", "platform_family"])["release_year"]
        .min()
        .reset_index()
        .sort_values("release_year")
    )

    def _status(title_key: str) -> str:
        families = family_per_title.get(title_key, set())
        if len(families) == 1:
            return "Exclusive"
        # Check for timed exclusive: one family in earliest year, more families later
        yf = year_family[year_family["title_key"] == title_key]
        if yf.empty or len(yf) < 2:
            return "Multiplatform"
        min_year = yf["release_year"].min()
        first_year_families = set(yf[yf["release_year"] == min_year]["platform_family"])
        if len(first_year_families) == 1 and len(families) > 1:
            return "Timed Exclusive"
        return "Multiplatform"

    df["exclusivity_status"] = df["title_key"].apply(_status)
    return df


def deduplicate(df: pd.DataFrame) -> pd.DataFrame:
    """Collapse duplicate (title_key, platform, region) rows."""
    dedup_key = ["title_key", "platform", "region"]
    dedup_key = [k for k in dedup_key if k in df.columns]

    if not dedup_key:
        return df

    def _merge_group(grp: pd.DataFrame) -> pd.Series:
        result = {}
        for col in grp.columns:
            if col in dedup_key:
                result[col] = grp[col].iloc[0]
                continue
            non_null = grp[col].dropna()
            if non_null.empty:
                result[col] = None
                continue
            if pd.api.types.is_numeric_dtype(grp[col]):
                if col in ("critic_score", "user_score", "oc_confidence", "match_confidence"):
                    result[col] = non_null.mean()
                else:
                    result[col] = non_null.sum()
            else:
                # Pick longest non-null string value; concatenate source labels
                if col == "_sources":
                    result[col] = "|".join(sorted(set("|".join(non_null.astype(str)).split("|"))))
                else:
                    result[col] = max(non_null.astype(str), key=len)
        return pd.Series(result)

    deduped = df.groupby(dedup_key, dropna=False).apply(_merge_group).reset_index(drop=True)
    logger.info("After dedup: %d rows (was %d)", len(deduped), len(df))
    return deduped


def flag_for_manual_review(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    flags = pd.Series(False, index=df.index)

    if "sales_missing" in df.columns:
        flags |= df["sales_missing"].fillna(True)
    if "oc_low_confidence" in df.columns:
        flags |= df["oc_low_confidence"].fillna(False)
    if "dimension" in df.columns:
        flags |= df["dimension"].fillna("Unknown") == "Unknown"
    if "company_era" in df.columns:
        flags |= df["company_era"].fillna("Unknown") == "Unknown"
    if "fuzzy_matched" in df.columns:
        flags |= df["fuzzy_matched"].fillna(False)
    if "release_year" in df.columns:
        flags |= df["release_year"].isna()

    df["needs_review"] = flags

    # Build human-readable reason string
    reasons = []
    if "sales_missing" in df.columns:
        reasons.append(df["sales_missing"].fillna(True).map({True: "missing_sales", False: ""}))
    if "oc_low_confidence" in df.columns:
        reasons.append(df["oc_low_confidence"].fillna(False).map({True: "low_confidence_score", False: ""}))
    if "dimension" in df.columns:
        reasons.append((df["dimension"].fillna("Unknown") == "Unknown").map({True: "unknown_dimension", False: ""}))
    if "company_era" in df.columns:
        reasons.append((df["company_era"].fillna("Unknown") == "Unknown").map({True: "unknown_era", False: ""}))
    if "release_year" in df.columns:
        reasons.append(df["release_year"].isna().map({True: "missing_year", False: ""}))

    if reasons:
        combined = reasons[0]
        for r in reasons[1:]:
            combined = combined.str.cat(r, sep="|", na_rep="")
        df["review_reason"] = combined.str.strip("|").str.replace(r"\|+", "|", regex=True)
    else:
        df["review_reason"] = ""

    return df


def _enforce_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure output columns exist and are in the correct order."""
    for col in OUTPUT_SCHEMA_COLUMNS:
        if col not in df.columns:
            df[col] = None
    return df[OUTPUT_SCHEMA_COLUMNS]


def run_merge(
    kaggle_df: pd.DataFrame,
    igdb_df: pd.DataFrame,
    oc_df: pd.DataFrame,
    wiki_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    master = build_master_title_list(kaggle_df, igdb_df, wiki_df)
    if master.empty:
        logger.error("Master title list is empty — no data to merge")
        return pd.DataFrame(columns=OUTPUT_SCHEMA_COLUMNS), pd.DataFrame()

    master = merge_igdb_metadata(master, igdb_df)
    master = merge_opencritic_scores(master, oc_df)
    master = merge_wikipedia_metadata(master, wiki_df)
    master = assign_exclusivity_status(master)
    master = deduplicate(master)
    master = flag_for_manual_review(master)

    review_df = master[master["needs_review"]].copy()
    final_df = _enforce_schema(master)

    logger.info(
        "Merge complete: %d total rows, %d flagged for review",
        len(final_df), len(review_df),
    )
    return final_df, review_df
