#!/usr/bin/env python3
"""
Square Enix Data Visualization — ETL Pipeline

Usage:
  python run_pipeline.py
  python run_pipeline.py --skip-igdb
  python run_pipeline.py --skip-igdb --skip-opencritic
  python run_pipeline.py --refresh-wikipedia
  python run_pipeline.py --dry-run
  python run_pipeline.py --verify-igdb-ids

Flags:
  --skip-igdb           Skip IGDB enrichment (useful for fast local runs)
  --skip-opencritic     Skip OpenCritic score fetching
  --refresh-wikipedia   Force re-fetch Wikipedia pages (ignore JSON cache)
  --dry-run             Run all stages but do not write output files
  --verify-igdb-ids     Print IGDB company IDs for Square/Enix and exit
"""
import argparse
import logging
import sys

import pandas as pd
from dotenv import load_dotenv

from pipeline.config import DATA_RAW, DATA_PROCESSED, DATA_OUTPUT, OPENCRITIC_CACHE_PATH
from pipeline.utils import setup_logging
from pipeline.kaggle_loader import load_kaggle_csv, _empty_kaggle_df
from pipeline.igdb_client import fetch_igdb_data, _empty_igdb_df, check_igdb_credentials, get_igdb_token, verify_company_ids
from pipeline.opencritic_client import fetch_opencritic_data, load_opencritic_csv, _empty_oc_df
from pipeline.wikipedia_scraper import fetch_wikipedia_data
from pipeline.normalizer import run_all_normalizations
from pipeline.merger import run_merge
from pipeline.reporter import run_reports

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Square Enix games ETL pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--skip-igdb", action="store_true", help="Skip IGDB API enrichment")
    parser.add_argument("--skip-opencritic", action="store_true", help="Skip OpenCritic scores")
    parser.add_argument("--refresh-wikipedia", action="store_true", help="Force Wikipedia re-fetch")
    parser.add_argument("--dry-run", action="store_true", help="Run pipeline but do not write files")
    parser.add_argument("--verify-igdb-ids", action="store_true", help="Print IGDB company IDs and exit")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    setup_logging()
    args = parse_args()

    # Ensure directories exist
    for d in (DATA_RAW, DATA_PROCESSED, DATA_OUTPUT):
        d.mkdir(parents=True, exist_ok=True)

    # --- Special mode: verify IGDB company IDs ---
    if args.verify_igdb_ids:
        client_id, client_secret = check_igdb_credentials()
        if not client_id:
            logger.error("Cannot verify IDs without IGDB credentials in .env")
            sys.exit(1)
        token = get_igdb_token(client_id, client_secret)
        if not token:
            sys.exit(1)
        verify_company_ids(token, client_id)
        return

    sources_used: list[str] = []

    # ----------------------------------------------------------------
    # Stage 1: Extract
    # ----------------------------------------------------------------
    logger.info("=== Stage 1: Extract ===")

    try:
        kaggle_df = load_kaggle_csv(DATA_RAW)
        sources_used.append("kaggle")
    except FileNotFoundError as exc:
        logger.warning("%s", exc)
        logger.warning("Continuing without Kaggle data — Wikipedia/IGDB will form the spine.")
        kaggle_df = _empty_kaggle_df()

    if not args.skip_igdb:
        igdb_df = fetch_igdb_data(DATA_RAW)
        if not igdb_df.empty:
            sources_used.append("igdb")
    else:
        logger.info("IGDB skipped (--skip-igdb)")
        igdb_df = _empty_igdb_df()

    wiki_df = fetch_wikipedia_data(force_refresh=args.refresh_wikipedia)
    if not wiki_df.empty:
        sources_used.append("wikipedia")

    # ----------------------------------------------------------------
    # Stage 2: Normalize each source independently
    # ----------------------------------------------------------------
    logger.info("=== Stage 2: Normalize ===")
    kaggle_df = run_all_normalizations(kaggle_df)
    igdb_df   = run_all_normalizations(igdb_df)
    wiki_df   = run_all_normalizations(wiki_df)

    # OpenCritic: collect full unique title list across all sources
    all_titles = (
        pd.concat([
            kaggle_df["title"] if "title" in kaggle_df.columns else pd.Series(dtype=str),
            igdb_df["title"]   if "title" in igdb_df.columns   else pd.Series(dtype=str),
            wiki_df["title"]   if "title" in wiki_df.columns   else pd.Series(dtype=str),
        ])
        .dropna()
        .unique()
        .tolist()
    )

    if not args.skip_opencritic:
        # Prefer local CSV over API — instant, no rate limits
        oc_df = load_opencritic_csv(DATA_RAW, all_titles)
        if oc_df.empty:
            logger.info("No OpenCritic CSV found — fetching from API")
            oc_df = fetch_opencritic_data(all_titles, OPENCRITIC_CACHE_PATH)
        if not oc_df.empty:
            sources_used.append("opencritic")
    else:
        logger.info("OpenCritic skipped (--skip-opencritic)")
        oc_df = _empty_oc_df()

    # ----------------------------------------------------------------
    # Stage 3: Merge
    # ----------------------------------------------------------------
    logger.info("=== Stage 3: Merge ===")
    final_df, review_df = run_merge(kaggle_df, igdb_df, oc_df, wiki_df)

    # Collect titles in master that were not matched to any enrichment source
    unmatched: list[str] = []
    if "title" in final_df.columns and "genre" in final_df.columns:
        unmatched = (
            final_df[final_df["genre"].isna()]["title"]
            .dropna()
            .unique()
            .tolist()
        )

    # ----------------------------------------------------------------
    # Stage 4: Report
    # ----------------------------------------------------------------
    logger.info("=== Stage 4: Report ===")
    if not args.dry_run:
        run_reports(final_df, review_df, sources_used, unmatched)
        logger.info("Pipeline complete. Outputs in: %s", DATA_OUTPUT)
    else:
        logger.info(
            "Dry run complete. Would write %d rows to squareenix_games.csv.",
            len(final_df),
        )
        logger.info("Sources used: %s", ", ".join(sources_used))
        logger.info("Rows for manual review: %d", len(review_df))


if __name__ == "__main__":
    main()
