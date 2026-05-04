import logging
from datetime import datetime
from pathlib import Path

import pandas as pd

from pipeline.config import OUTPUT_CSV, QUALITY_REPORT, MANUAL_REVIEW, OUTPUT_SCHEMA_COLUMNS

logger = logging.getLogger(__name__)


def write_final_csv(df: pd.DataFrame) -> None:
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    # Ensure correct column order; fill missing schema cols with None
    for col in OUTPUT_SCHEMA_COLUMNS:
        if col not in df.columns:
            df[col] = None
    df[OUTPUT_SCHEMA_COLUMNS].to_csv(OUTPUT_CSV, index=False, encoding="utf-8")
    logger.info("Final CSV written: %s (%d rows)", OUTPUT_CSV, len(df))


def write_manual_review_csv(review_df: pd.DataFrame) -> None:
    if review_df.empty:
        logger.info("No rows flagged for manual review.")
        return
    MANUAL_REVIEW.parent.mkdir(parents=True, exist_ok=True)
    # Include all output columns plus review metadata
    cols = OUTPUT_SCHEMA_COLUMNS + ["review_reason", "match_confidence", "fuzzy_matched", "_sources"]
    cols = [c for c in cols if c in review_df.columns]
    review_df[cols].to_csv(MANUAL_REVIEW, index=False, encoding="utf-8")
    logger.info("Manual review CSV written: %s (%d rows)", MANUAL_REVIEW, len(review_df))


def generate_quality_report(
    df: pd.DataFrame,
    review_df: pd.DataFrame,
    sources_used: list[str],
    unmatched_titles: list[str],
) -> None:
    QUALITY_REPORT.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    w = lines.append

    w("=" * 70)
    w("SQUARE ENIX DATA VISUALIZATION — DATA QUALITY REPORT")
    w(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    w("=" * 70)
    w("")

    # Overview
    unique_titles = df["title"].nunique() if "title" in df.columns else "N/A"
    w("OVERVIEW")
    w("-" * 40)
    w(f"  Total unique game titles : {unique_titles}")
    w(f"  Total rows (title+platform+region): {len(df)}")
    w(f"  Rows flagged for manual review     : {len(review_df)}")
    w(f"  Sources used               : {', '.join(sources_used) or 'none'}")
    w("")

    # Missing values per column
    w("MISSING VALUES PER COLUMN")
    w("-" * 40)
    for col in OUTPUT_SCHEMA_COLUMNS:
        if col in df.columns:
            n_missing = df[col].isna().sum()
            pct = 100 * n_missing / len(df) if len(df) else 0
            w(f"  {col:<30} {n_missing:>6} missing  ({pct:.1f}%)")
    w("")

    # Platform coverage
    if "platform" in df.columns and "title" in df.columns:
        w("PLATFORM COVERAGE (unique titles per platform)")
        w("-" * 40)
        platform_counts = (
            df.drop_duplicates(subset=["title", "platform"])
            .groupby("platform")["title"]
            .nunique()
            .sort_values(ascending=False)
        )
        for platform, count in platform_counts.items():
            w(f"  {platform:<25} {count:>4} titles")
        w("")

    # Company era distribution
    if "company_era" in df.columns and "title" in df.columns:
        w("COMPANY ERA DISTRIBUTION (unique titles)")
        w("-" * 40)
        era_counts = (
            df.drop_duplicates(subset=["title"])
            .groupby("company_era")["title"]
            .nunique()
            .sort_values(ascending=False)
        )
        for era, count in era_counts.items():
            w(f"  {era:<25} {count:>4} titles")
        w("")

    # Manual review breakdown
    if not review_df.empty and "review_reason" in review_df.columns:
        w("MANUAL REVIEW BREAKDOWN (rows by reason)")
        w("-" * 40)
        from collections import Counter
        reason_counts: Counter = Counter()
        for reasons in review_df["review_reason"].dropna():
            for r in str(reasons).split("|"):
                if r:
                    reason_counts[r] += 1
        for reason, count in reason_counts.most_common():
            w(f"  {reason:<35} {count:>5} rows")
        w("")

    # Unmatched titles
    if unmatched_titles:
        w(f"TITLES NOT MATCHED ACROSS ENRICHMENT SOURCES ({len(unmatched_titles)})")
        w("-" * 40)
        for t in sorted(unmatched_titles)[:100]:
            w(f"  - {t}")
        if len(unmatched_titles) > 100:
            w(f"  ... and {len(unmatched_titles) - 100} more")
        w("")

    w("=" * 70)

    QUALITY_REPORT.write_text("\n".join(lines), encoding="utf-8")
    logger.info("Quality report written: %s", QUALITY_REPORT)


def run_reports(
    df: pd.DataFrame,
    review_df: pd.DataFrame,
    sources_used: list[str],
    unmatched_titles: list[str],
) -> None:
    write_final_csv(df)
    write_manual_review_csv(review_df)
    generate_quality_report(df, review_df, sources_used, unmatched_titles)
