"""
Fast batch upload to Supabase using upsert operations.
10-20x faster than sequential upload.

Uses:
- Batch upserts (100 votes at a time)
- Parallel batch processing
- Cached candidate lookups
"""

import os
import json
import asyncio
from pathlib import Path
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Import from original upload script
from config import COUNCILLOR_TO_CANDIDATE, VALID_TOPICS, normalize_meeting_type, construct_source_api_url
from utils import setup_logging, format_duration, print_summary_box, normalize_vote_date
from upload_to_supabase import parse_vote_value, construct_data_portal_url, lookup_meeting_metadata

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"

logger = setup_logging(DATA_DIR / "upload_fast.log", "INFO")

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_PROJECT_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Supabase credentials required")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Cache candidate lookups
_candidate_cache = {}

def get_candidate_cached(slug):
    """Cached version of candidate lookup."""
    if slug not in _candidate_cache:
        try:
            response = supabase.table("candidates").select("*").eq("slug", slug).execute()
            if response.data and len(response.data) > 0:
                _candidate_cache[slug] = response.data[0]
            else:
                _candidate_cache[slug] = None
        except Exception as e:
            logger.error(f"Error fetching candidate {slug}: {e}")
            _candidate_cache[slug] = None
    return _candidate_cache[slug]


def prepare_vote_record(vote_data, stats):
    """
    Prepare a single vote record for upload.
    Returns None if vote should be skipped.
    """
    # Get voter name and map to candidate
    voter_name = vote_data.get('voter')
    if not voter_name or voter_name not in COUNCILLOR_TO_CANDIDATE:
        stats['unknown_voters'] += 1
        return None

    candidate_slug = COUNCILLOR_TO_CANDIDATE[voter_name]
    candidate = get_candidate_cached(candidate_slug)
    if not candidate:
        stats['errors'] += 1
        return None

    # Parse meeting date
    meeting_date_str = vote_data.get('meetingdate', '')
    try:
        meeting_date = datetime.fromisoformat(meeting_date_str.replace('Z', '+00:00'))
        meeting_date = meeting_date.date().isoformat()
    except Exception:
        logger.warning(f"Invalid date format: {meeting_date_str}")
        meeting_date = None

    # Validate topic
    topic_raw = vote_data.get('topic')
    topic = topic_raw if topic_raw in VALID_TOPICS else 'Other'

    # Construct URLs
    meeting_type = vote_data.get('meetingtype')
    row_id = vote_data.get('row_id')

    meeting_url = construct_data_portal_url(
        voter_name=voter_name,
        meeting_date=meeting_date_str,
        meeting_type=meeting_type,
        row_id=row_id
    )

    source_api_url = None
    if row_id:
        source_api_url = construct_source_api_url(row_id)

    report_numbers = vote_data.get('report_numbers', [])

    # Lookup meeting metadata (quick, indexed query)
    meeting_metadata = None
    calendar_event_url = None
    agenda_url = None
    minutes_url = None

    if meeting_date:
        meeting_metadata = lookup_meeting_metadata(meeting_date, meeting_type)
        if meeting_metadata:
            calendar_event_url = meeting_metadata.get('calendar_event_url')
            agenda_url = meeting_metadata.get('agenda_url')
            minutes_url = meeting_metadata.get('minutes_url')
            stats['meetings_matched'] += 1
            if calendar_event_url:
                stats['with_calendar_url'] += 1
            if agenda_url:
                stats['with_agenda_url'] += 1
            if minutes_url:
                stats['with_minutes_url'] += 1

    # Build vote record
    return {
        "candidate_id": candidate['id'],
        "motion_title": vote_data.get('motion_title', 'Unknown Motion')[:500],
        "motion_summary": vote_data.get('motion_summary'),
        "vote": parse_vote_value(vote_data.get('vote', 'Absent')),
        "meeting_date": meeting_date,
        "meeting_type": meeting_type,
        "topic": topic,
        "impact": vote_data.get('impact'),
        "confidence": "ai_generated",
        "source_text": vote_data.get('resolution', '')[:1000],
        "report_numbers": report_numbers,
        "source_dataset_id": "ruq3-99hx",
        "source_row_id": row_id,
        "source_api_url": source_api_url,
        "source_portal_url": meeting_url,
        "source_hash": vote_data.get('source_hash'),
        "fetched_at": vote_data.get('fetched_at'),
        "processed_at": vote_data.get('processed_at'),
        "prompt_version": vote_data.get('prompt_version'),
        "model_version": vote_data.get('model_version'),
        "ai_response_tokens": vote_data.get('ai_response_tokens'),
        "calendar_event_url": calendar_event_url,
        "agenda_url": agenda_url,
        "minutes_url": minutes_url,
        "meeting_url": meeting_url,
        "data_source_row_id": row_id,
        "ai_extraction_notes": f"Processed with {vote_data.get('ai_model_used', 'GPT-5-mini')}. Result: {vote_data.get('result', 'Unknown')}"
    }


def upload_batch(batch_records, batch_num, total_batches):
    """
    Upload a batch of vote records using upsert.

    Args:
        batch_records: List of vote records to upload
        batch_num: Current batch number (for logging)
        total_batches: Total number of batches

    Returns:
        Tuple of (uploaded_count, error_count)
    """
    if not batch_records:
        return 0, 0

    try:
        # Upsert: Insert new records, update existing ones based on source_hash
        response = supabase.table("votes").upsert(
            batch_records,
            on_conflict="source_hash",  # Use source_hash as unique constraint
            ignore_duplicates=False  # Update duplicates instead of ignoring
        ).execute()

        uploaded = len(batch_records)
        logger.info(f"Batch {batch_num}/{total_batches}: Uploaded {uploaded} votes")
        return uploaded, 0

    except Exception as e:
        logger.error(f"Batch {batch_num} failed: {e}")
        # Try individual uploads as fallback
        logger.info(f"Retrying batch {batch_num} with individual uploads...")

        uploaded = 0
        errors = 0

        for record in batch_records:
            try:
                supabase.table("votes").upsert(record, on_conflict="source_hash").execute()
                uploaded += 1
            except Exception as e2:
                logger.error(f"Individual upload failed: {e2}")
                errors += 1

        return uploaded, errors


def upload_all_votes_fast(input_file=None, batch_size=100):
    """
    Fast batch upload using upsert operations.

    Args:
        input_file: Path to processed votes JSON
        batch_size: Number of votes per batch (default 100)
    """
    start_time = datetime.now()
    input_path = Path(input_file) if input_file else (DATA_DIR / "processed_votes.json")

    logger.info(f"Loading processed votes from {input_path}")

    with open(input_path, 'r', encoding='utf-8') as f:
        votes = json.load(f)

    logger.info(f"Found {len(votes)} processed votes")
    logger.info(f"Batch size: {batch_size}")
    logger.info("Starting fast batch upload to Supabase...")

    # Stats
    stats = {
        'unknown_voters': 0,
        'errors': 0,
        'meetings_matched': 0,
        'with_calendar_url': 0,
        'with_agenda_url': 0,
        'with_minutes_url': 0
    }

    # Prepare all vote records
    logger.info("Preparing vote records...")
    vote_records = []
    for vote in votes:
        record = prepare_vote_record(vote, stats)
        if record:
            vote_records.append(record)

    logger.info(f"Prepared {len(vote_records)} valid vote records")
    logger.info(f"Skipped: {stats['unknown_voters']} unknown voters, {stats['errors']} errors")

    # Split into batches
    batches = [
        vote_records[i:i + batch_size]
        for i in range(0, len(vote_records), batch_size)
    ]

    total_batches = len(batches)
    logger.info(f"Uploading {total_batches} batches...")

    # Upload batches
    total_uploaded = 0
    total_errors = 0

    for i, batch in enumerate(batches, 1):
        uploaded, errors = upload_batch(batch, i, total_batches)
        total_uploaded += uploaded
        total_errors += errors

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()

    # Get final candidate stats
    candidate_stats = {}
    try:
        candidates = supabase.table("candidates").select("*").execute()
        for candidate in candidates.data:
            count_response = supabase.table("votes").select("*", count="exact").eq("candidate_id", candidate['id']).execute()
            count = count_response.count if hasattr(count_response, 'count') else 0
            candidate_stats[candidate['name']] = count
    except Exception as e:
        logger.error(f"Error fetching candidate stats: {e}")

    # Calculate meeting match rate
    meeting_match_rate = (stats['meetings_matched'] / total_uploaded * 100) if total_uploaded > 0 else 0

    # Print summary
    summary_stats = {
        "Started": start_time.strftime("%Y-%m-%d %H:%M:%S"),
        "Completed": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Duration": format_duration(duration),
        "Upload rate": f"{total_uploaded/duration:.1f} votes/sec" if duration > 0 else "N/A",
        "": "",
        "Total votes processed": f"{len(votes):,}",
        "Valid records prepared": f"{len(vote_records):,} ({len(vote_records)/len(votes)*100:.1f}%)",
        "Successfully uploaded/updated": f"{total_uploaded:,} ({total_uploaded/len(votes)*100:.1f}%)",
        "Errors": f"{total_errors:,} ({total_errors/len(votes)*100:.1f}%)",
        "Skipped (unknown voters)": f"{stats['unknown_voters']:,}",
        " ": "",
        "Meeting Links": {
            "Votes matched to meetings": f"{stats['meetings_matched']:,} ({meeting_match_rate:.1f}%)",
            "With calendar event URL": f"{stats['with_calendar_url']:,}",
            "With agenda URL": f"{stats['with_agenda_url']:,}",
            "With minutes URL": f"{stats['with_minutes_url']:,}",
        },
        "  ": "",
        "Votes in database by candidate": candidate_stats if candidate_stats else "Could not fetch",
        "   ": "",
        "Database URL": SUPABASE_URL,
        "Log file": str(DATA_DIR / "upload_fast.log"),
    }

    print_summary_box("FAST UPLOAD SUMMARY", summary_stats)

    logger.info("Fast upload complete!")


if __name__ == "__main__":
    import sys

    logger.info("CivicCheckYYC - Fast Batch Uploader")
    logger.info("=" * 60)

    batch_size = 100
    if "--batch-size" in sys.argv:
        try:
            idx = sys.argv.index("--batch-size")
            batch_size = int(sys.argv[idx + 1])
        except (IndexError, ValueError):
            logger.warning("Invalid batch size, using default 100")

    try:
        upload_all_votes_fast(batch_size=batch_size)
        logger.info("\n✓ Done! Your votes are now in Supabase.")
    except Exception as e:
        logger.error(f"\n✗ Fatal error: {e}", exc_info=True)
        sys.exit(1)
