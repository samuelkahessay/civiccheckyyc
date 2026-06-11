"""
Meeting Indexer for CivicCheckYYC - Phase 1.5

Fetches meeting metadata from Calgary Open Data calendar dataset (23m4-i42g)
and stores in local cache and Supabase meetings table.

Purpose:
- Populate calendar_event_url, agenda_url, minutes_url for votes
- Enable vote-to-meeting linking by date + type matching

Data Flow:
1. Fetch meetings from Calgary calendar dataset
2. Parse dates and normalize meeting types
3. Extract Trumba calendar event URLs
4. (Optional) Scrape eScribe for agenda/minutes URLs
5. Save to data/meetings_index.json (timestamped archive)
6. Upsert to Supabase meetings table

Usage:
    python index_meetings.py                    # Fetch all meetings
    python index_meetings.py --years-back 2     # Fetch last 2 years only
    python index_meetings.py --test             # Test with 10 meetings
"""

import os
import sys
import json
import logging
import requests
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Import shared utilities and config
from config import (
    MEETINGS_DATASET_ID,
    MEETINGS_CACHE_FILE,
    SOCRATA_BASE_URL,
    MEETING_FETCH_YEARS_BACK,
    MEETING_INDEX_BATCH_SIZE,
    normalize_meeting_type
)
from utils import (
    setup_logging,
    format_duration,
    print_summary_box,
    parse_calgary_meeting_date,
    extract_trumba_event_id,
    retry_with_backoff
)

load_dotenv()

# Resolve repo root and data directory
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
ARCHIVES_DIR = DATA_DIR / "archives"

# Initialize logging
logger = setup_logging(DATA_DIR / "meeting_indexer.log", "INFO")

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_PROJECT_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.warning("Supabase credentials not found. Will only save to local cache.")
    supabase: Optional[Client] = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


@retry_with_backoff(max_retries=3, exceptions=(requests.exceptions.RequestException,))
def fetch_meetings_from_socrata(years_back: int = MEETING_FETCH_YEARS_BACK, limit: Optional[int] = None) -> List[Dict]:
    """
    Fetch meetings from Calgary calendar dataset (23m4-i42g).

    Args:
        years_back: Fetch meetings from last N years
        limit: Limit number of meetings to fetch (for testing)

    Returns:
        List of meeting dictionaries

    API Endpoint:
        https://data.calgary.ca/resource/23m4-i42g.json
    """
    logger.info(f"Fetching meetings from Calgary calendar dataset ({MEETINGS_DATASET_ID})")

    # Construct API URL
    api_url = f"{SOCRATA_BASE_URL}/resource/{MEETINGS_DATASET_ID}.json"

    # Build query parameters
    params = {
        "$select": "title, meeting_date, link",
        "$order": "meeting_date DESC"
    }

    if limit:
        params["$limit"] = limit
        logger.info(f"Test mode: Limiting to {limit} meetings")
    else:
        params["$limit"] = 10000  # Fetch up to 10,000 meetings

    # Fetch from API
    response = requests.get(api_url, params=params, timeout=30)
    response.raise_for_status()

    meetings = response.json()
    logger.info(f"✓ Fetched {len(meetings)} meetings from Calgary Open Data")

    return meetings


def process_meeting_record(raw_meeting: Dict) -> Optional[Dict]:
    """
    Process a raw meeting record from Calgary calendar dataset.

    Extracts:
    - meeting_date (normalized to ISO format)
    - meeting_type (from title field)
    - normalized_type (standardized for matching)
    - calendar_event_url (Trumba link)
    - calendar_event_id (extracted from URL)

    Args:
        raw_meeting: Raw meeting dict from Socrata API

    Returns:
        Processed meeting dict or None if parsing fails
    """
    meeting_title = raw_meeting.get('title', '')
    meeting_date_str = raw_meeting.get('meeting_date', '')
    calendar_url = raw_meeting.get('link', '')

    # Parse date
    meeting_date = parse_calgary_meeting_date(meeting_date_str)
    if not meeting_date:
        logger.warning(f"Failed to parse date for meeting: {meeting_date_str}")
        return None

    # Normalize meeting type
    normalized_type = normalize_meeting_type(meeting_title)

    # Extract Trumba event ID
    event_id = extract_trumba_event_id(calendar_url)

    # Build processed meeting record
    processed_meeting = {
        "meeting_date": meeting_date,
        "meeting_type": meeting_title,  # Original type from calendar
        "normalized_type": normalized_type,  # Standardized for matching
        "calendar_event_url": calendar_url,
        "calendar_event_id": event_id,
        "source_dataset_id": MEETINGS_DATASET_ID,
        "fetched_at": datetime.now().isoformat()
    }

    return processed_meeting


def save_to_local_cache(meetings: List[Dict]) -> None:
    """
    Save meetings to local JSON cache with timestamped archive.

    Args:
        meetings: List of processed meeting dicts
    """
    # Create archives directory
    ARCHIVES_DIR.mkdir(parents=True, exist_ok=True)

    # Save to main cache file
    cache_path = DATA_DIR / MEETINGS_CACHE_FILE
    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(meetings, f, indent=2, ensure_ascii=False)

    logger.info(f"✓ Saved {len(meetings)} meetings to {cache_path}")

    # Save timestamped archive (immutable)
    timestamp_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    archive_path = ARCHIVES_DIR / f"meetings_index_{timestamp_str}.json"

    with open(archive_path, 'w', encoding='utf-8') as f:
        json.dump(meetings, f, indent=2, ensure_ascii=False)

    logger.info(f"✓ Saved archive to {archive_path}")


def upload_to_supabase(meetings: List[Dict]) -> Dict[str, int]:
    """
    Upload meetings to Supabase meetings table (upsert by date+type).

    Args:
        meetings: List of processed meeting dicts

    Returns:
        Dict with counts: {"inserted": N, "updated": M, "errors": K}
    """
    if not supabase:
        logger.warning("Supabase not configured. Skipping upload.")
        return {"inserted": 0, "updated": 0, "errors": 0}

    logger.info(f"Uploading {len(meetings)} meetings to Supabase...")

    inserted = 0
    updated = 0
    errors = 0

    for i, meeting in enumerate(meetings, 1):
        if i % MEETING_INDEX_BATCH_SIZE == 0:
            logger.info(f"Progress: {i}/{len(meetings)} ({inserted} inserted, {updated} updated, {errors} errors)")

        try:
            # Prepare record for upsert
            meeting_record = {
                "meeting_date": meeting["meeting_date"],
                "meeting_type": meeting["meeting_type"],
                "normalized_type": meeting["normalized_type"],
                "calendar_event_url": meeting.get("calendar_event_url"),
                "calendar_event_id": meeting.get("calendar_event_id"),
                "source_dataset_id": meeting.get("source_dataset_id"),
                "fetched_at": meeting.get("fetched_at"),
                "updated_at": datetime.now().isoformat()
            }

            # Upsert (insert or update on conflict)
            # Note: Supabase Python client doesn't have native upsert with conflict resolution
            # So we'll try insert first, then update on duplicate error

            # Check if meeting exists
            existing = supabase.table("meetings").select("id").eq("meeting_date", meeting["meeting_date"]).eq("normalized_type", meeting["normalized_type"]).execute()

            if existing.data and len(existing.data) > 0:
                # Update existing
                meeting_id = existing.data[0]['id']
                supabase.table("meetings").update(meeting_record).eq("id", meeting_id).execute()
                updated += 1
            else:
                # Insert new
                supabase.table("meetings").insert(meeting_record).execute()
                inserted += 1

        except Exception as e:
            logger.error(f"Failed to upload meeting {meeting['meeting_date']} - {meeting['meeting_type']}: {e}")
            errors += 1

    logger.info(f"✓ Upload complete: {inserted} inserted, {updated} updated, {errors} errors")

    return {
        "inserted": inserted,
        "updated": updated,
        "errors": errors
    }


def index_meetings(years_back: int = MEETING_FETCH_YEARS_BACK, test_mode: bool = False) -> None:
    """
    Main meeting indexer workflow.

    Args:
        years_back: Fetch meetings from last N years
        test_mode: If True, only process 10 meetings
    """
    start_time = datetime.now()

    logger.info("=" * 60)
    logger.info("CivicCheckYYC - Meeting Indexer (Phase 1.5)")
    logger.info("=" * 60)

    # Step 1: Fetch meetings from Socrata
    limit = 10 if test_mode else None
    raw_meetings = fetch_meetings_from_socrata(years_back=years_back, limit=limit)

    if not raw_meetings:
        logger.error("No meetings fetched. Exiting.")
        return

    # Step 2: Process meetings
    logger.info(f"Processing {len(raw_meetings)} meetings...")
    processed_meetings = []
    failed_count = 0

    for raw_meeting in raw_meetings:
        processed = process_meeting_record(raw_meeting)
        if processed:
            processed_meetings.append(processed)
        else:
            failed_count += 1

    logger.info(f"✓ Processed {len(processed_meetings)} meetings ({failed_count} failed)")

    # Step 3: Save to local cache
    save_to_local_cache(processed_meetings)

    # Step 4: Upload to Supabase
    upload_stats = upload_to_supabase(processed_meetings)

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()

    # Print summary
    stats = {
        "Started": start_time.strftime("%Y-%m-%d %H:%M:%S"),
        "Completed": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Duration": format_duration(duration),
        "": "",
        "Meetings fetched": f"{len(raw_meetings):,}",
        "Meetings processed": f"{len(processed_meetings):,}",
        "Failed to parse": f"{failed_count:,}",
        " ": "",
        "Database uploads": upload_stats if supabase else "Supabase not configured",
        "  ": "",
        "Cache file": str(DATA_DIR / MEETINGS_CACHE_FILE),
        "Archives": str(ARCHIVES_DIR),
        "Log file": str(DATA_DIR / "meeting_indexer.log")
    }

    print_summary_box("MEETING INDEXER SUMMARY", stats)

    logger.info("Meeting indexer complete!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Index Calgary council meetings")
    parser.add_argument("--years-back", type=int, default=MEETING_FETCH_YEARS_BACK,
                        help=f"Fetch meetings from last N years (default: {MEETING_FETCH_YEARS_BACK})")
    parser.add_argument("--test", action="store_true",
                        help="Test mode: process only 10 meetings")

    args = parser.parse_args()

    try:
        index_meetings(years_back=args.years_back, test_mode=args.test)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
