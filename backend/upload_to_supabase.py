"""
Upload processed voting records to Supabase.
Matches councillor names to candidate IDs and uploads votes.

Enhanced with:
- Structured logging
- Better summary reports
- Source URL construction for Open Data portal
- Import config from centralized config.py
"""

import os
import json
import logging
from pathlib import Path
from urllib.parse import quote
from typing import Optional, Dict
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# Import shared utilities and config
from config import COUNCILLOR_TO_CANDIDATE, VALID_TOPICS, normalize_meeting_type
from utils import setup_logging, format_duration, print_summary_box, normalize_vote_date

load_dotenv()

# Resolve repo root and data directory regardless of CWD
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"

# Initialize logging
logger = setup_logging(DATA_DIR / "upload.log", "INFO")

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_PROJECT_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_PROJECT_URL is required")

key_for_writes = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
if not key_for_writes:
    raise RuntimeError("Set SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_ANON_KEY in your environment")

if not SUPABASE_SERVICE_ROLE_KEY:
    logger.warning("Using ANON key; inserts may fail due to RLS. Prefer SUPABASE_SERVICE_ROLE_KEY for server-side scripts.")

supabase: Client = create_client(SUPABASE_URL, key_for_writes)


def get_candidate_by_slug(slug):
    """
    Fetch candidate from Supabase by slug.

    Returns:
        Candidate dict with id, or None if not found
    """
    try:
        response = supabase.table("candidates").select("*").eq("slug", slug).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        else:
            logger.warning(f"Candidate not found for slug: {slug}")
            return None
    except Exception as e:
        logger.error(f"Error fetching candidate {slug}: {e}")
        return None


def parse_vote_value(vote_str):
    """
    Convert Open Calgary vote values to our schema format.

    Open Calgary uses: "Yes", "No", "Absent"
    Our schema uses: "for", "against", "absent"
    """
    vote_map = {
        "Yes": "for",
        "No": "against",
        "Absent": "absent",
        "yes": "for",
        "no": "against",
        "absent": "absent"
    }
    return vote_map.get(vote_str, "absent")


def construct_data_portal_url(voter_name, meeting_date, meeting_type=None, row_id=None):
    """
    Construct a URL to the Calgary Open Data portal for viewing a specific vote.

    Priority:
    1. If row_id exists, use row-based explore URL (most reliable)
    2. Fallback to dataset homepage

    Note: Query parameter filtering (/data?voter=X) is not reliably supported
    by Calgary's Socrata portal, so we prioritize row-level linking.

    Args:
        voter_name: Councillor name (e.g., "Mayor J. Gondek") - not used
        meeting_date: ISO date string (e.g., "2024-09-05T00:00:00.000") - not used
        meeting_type: Meeting type (optional) - not used
        row_id: Socrata row ID (e.g., "row-p5zy~f4hc_ii6x")

    Returns:
        URL string to Open Data portal

    TODO: Test and verify these patterns work:
        - /Government/Council-and-Committee-Votes/ruq3-99hx/explore?row={row_id}
        - /d/ruq3-99hx?row={row_id}
    """
    BASE_DATASET_URL = "https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx"

    # If we have a row ID, try row-based explore link
    # Format: https://data.calgary.ca/d/ruq3-99hx?row=row-p5zy~f4hc_ii6x
    if row_id:
        # Try explore pattern (most common for Socrata)
        return f"https://data.calgary.ca/d/ruq3-99hx?row={row_id}"

    # Fallback to dataset homepage if no row_id
    return BASE_DATASET_URL


def lookup_meeting_metadata(meeting_date: str, meeting_type: str) -> Optional[Dict]:
    """
    Lookup meeting metadata from meetings table.

    Args:
        meeting_date: ISO date string (YYYY-MM-DD)
        meeting_type: Meeting type from vote (will be normalized)

    Returns:
        Meeting dict with calendar_event_url, agenda_url, minutes_url or None
    """
    if not supabase:
        return None

    try:
        # Normalize meeting type for matching
        normalized_type = normalize_meeting_type(meeting_type)

        # Query meetings table
        response = supabase.table("meetings").select("*").eq("meeting_date", meeting_date).eq("normalized_type", normalized_type).execute()

        if response.data and len(response.data) > 0:
            return response.data[0]
        else:
            logger.debug(f"No meeting found for {meeting_date} - {normalized_type}")
            return None

    except Exception as e:
        logger.warning(f"Failed to lookup meeting metadata: {e}")
        return None


def _is_blank(value) -> bool:
    """Return True if value is None, empty string, or empty list."""
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    return False


def _backfill_duplicate_by_source_hash(source_hash: str, vote_record: Dict) -> int:
    """
    Backfill missing fields for an existing vote identified by source_hash.

    Only updates fields that are currently blank (NULL/empty) in the database
    and have non-blank values in the provided vote_record.

    Returns:
        Number of fields updated (0 if no-op, -1 on error)
    """
    if not source_hash:
        return -1

    try:
        existing_resp = supabase.table("votes").select("*").eq("source_hash", source_hash).execute()
        if not existing_resp.data:
            return -1

        existing = existing_resp.data[0]
        update_fields: Dict = {}

        for k, v in vote_record.items():
            # Never update the unique identity or internal identifiers via backfill
            if k in ("id", "source_hash"):
                continue

            # Only fill if DB value is blank and new value is meaningful
            if _is_blank(existing.get(k)) and not _is_blank(v):
                update_fields[k] = v

        if update_fields:
            supabase.table("votes").update(update_fields).eq("source_hash", source_hash).execute()
            return len(update_fields)

        return 0

    except Exception as e:
        logger.error(f"Backfill update failed for source_hash={source_hash}: {e}")
        return -1


def upload_vote(vote_data, stats: Optional[Dict] = None):
    """
    Upload a single vote to Supabase.

    Args:
        vote_data: Processed vote dict with AI-generated fields
        stats: Optional dict to track meeting match statistics

    Returns:
        "uploaded", "duplicate", "unknown_voter", or "error"
    """
    # Get voter name and map to candidate
    voter_name = vote_data.get('voter')
    if not voter_name or voter_name not in COUNCILLOR_TO_CANDIDATE:
        logger.debug(f"Skipping unknown voter: {voter_name}")
        return "unknown_voter"

    candidate_slug = COUNCILLOR_TO_CANDIDATE[voter_name]
    candidate = get_candidate_by_slug(candidate_slug)
    if not candidate:
        return "error"

    # Parse meeting date
    meeting_date_str = vote_data.get('meetingdate', '')
    try:
        # Format: "2022-06-16T00:00:00.000"
        meeting_date = datetime.fromisoformat(meeting_date_str.replace('Z', '+00:00'))
        meeting_date = meeting_date.date().isoformat()
    except Exception:
        logger.warning(f"Invalid date format: {meeting_date_str}")
        meeting_date = None

    # Prepare vote record
    # Validate topic against allowed set
    topic_raw = vote_data.get('topic')
    topic = topic_raw if topic_raw in VALID_TOPICS else 'Other'

    # Phase 1: Construct all source URLs and provenance fields
    voter_name = vote_data.get('voter')
    meeting_date_str = vote_data.get('meetingdate', '')
    meeting_type = vote_data.get('meetingtype')
    row_id = vote_data.get('row_id')  # Socrata row ID

    # Construct source URLs
    meeting_url = construct_data_portal_url(
        voter_name=voter_name,
        meeting_date=meeting_date_str,
        meeting_type=meeting_type,
        row_id=row_id
    )

    # Phase 1: Construct source_api_url (direct JSON API access)
    source_api_url = None
    if row_id:
        from config import construct_source_api_url
        source_api_url = construct_source_api_url(row_id)

    # Extract report numbers (if processed by AI processor)
    report_numbers = vote_data.get('report_numbers', [])

    # Phase 1.5: Lookup meeting metadata for agenda/minutes links
    meeting_metadata = None
    if meeting_date:  # Only lookup if we have a valid meeting date
        meeting_metadata = lookup_meeting_metadata(meeting_date, meeting_type)

    # Extract meeting URLs from metadata
    calendar_event_url = None
    agenda_url = None
    minutes_url = None

    if meeting_metadata:
        calendar_event_url = meeting_metadata.get('calendar_event_url')
        agenda_url = meeting_metadata.get('agenda_url')
        minutes_url = meeting_metadata.get('minutes_url')
        logger.debug(f"✓ Found meeting metadata for {meeting_date} - {meeting_type}")

        # Track meeting match statistics
        if stats is not None:
            stats['meetings_matched'] = stats.get('meetings_matched', 0) + 1
            if calendar_event_url:
                stats['with_calendar_url'] = stats.get('with_calendar_url', 0) + 1
            if agenda_url:
                stats['with_agenda_url'] = stats.get('with_agenda_url', 0) + 1
            if minutes_url:
                stats['with_minutes_url'] = stats.get('with_minutes_url', 0) + 1

    # Phase 1: Full provenance record
    vote_record = {
        # Basic vote data
        "candidate_id": candidate['id'],
        "motion_title": vote_data.get('motion_title', 'Unknown Motion')[:500],
        "motion_summary": vote_data.get('motion_summary'),
        "vote": parse_vote_value(vote_data.get('vote', 'Absent')),
        "meeting_date": meeting_date,
        "meeting_type": meeting_type,
        "topic": topic,
        "impact": vote_data.get('impact'),  # AI-generated impact assessment (high, medium, low)
        "confidence": "ai_generated",
        "source_text": vote_data.get('resolution', '')[:1000],
        "report_numbers": report_numbers,

        # Phase 1: Socrata provenance
        "source_dataset_id": "ruq3-99hx",  # Calgary Council and Committee Votes
        "source_row_id": row_id,
        "source_api_url": source_api_url,  # Direct JSON API URL
        "source_portal_url": meeting_url,  # Filtered web UI view
        "source_hash": vote_data.get('source_hash'),  # SHA-256 hash for deduplication

        # Phase 1: Timestamps
        "fetched_at": vote_data.get('fetched_at'),  # When fetched from Open Data
        "processed_at": vote_data.get('processed_at'),  # When processed by AI

        # Phase 1: AI provenance
        "prompt_version": vote_data.get('prompt_version'),  # e.g., "v1.0-2025-10-08"
        "model_version": vote_data.get('model_version'),  # e.g., "gpt-5-mini@2025-10-01"
        "ai_response_tokens": vote_data.get('ai_response_tokens'),  # Token count for cost tracking

        # Phase 1.5: Meeting links (from meetings table)
        "calendar_event_url": calendar_event_url,  # Trumba calendar event page
        "agenda_url": agenda_url,  # Meeting agenda document
        "minutes_url": minutes_url,  # Meeting minutes document

        # Legacy/deprecated (kept for backwards compatibility)
        "meeting_url": meeting_url,
        "data_source_row_id": row_id,  # DEPRECATED: Use source_row_id instead
        "ai_extraction_notes": f"Processed with {vote_data.get('ai_model_used', 'GPT-5-mini')}. Result: {vote_data.get('result', 'Unknown')}"
    }

    # Upload to Supabase
    try:
        response = supabase.table("votes").insert(vote_record).execute()
        return "uploaded"
    except Exception as e:
        # Check if it's a duplicate
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            # Attempt to backfill missing fields for the existing row
            updated_count = _backfill_duplicate_by_source_hash(vote_data.get('source_hash'), vote_record)
            if updated_count > 0:
                logger.debug(
                    f"Duplicate found; backfilled {updated_count} fields for {vote_data.get('voter')} on {meeting_date}"
                )
                return "backfilled"
            if updated_count == 0:
                logger.debug(f"Duplicate vote skipped (no fields to backfill): {vote_data.get('voter')} on {meeting_date}")
                return "duplicate"
            # updated_count < 0 indicates an error during backfill
            logger.error(f"Duplicate detected but backfill failed for source_hash={vote_data.get('source_hash')}")
            return "error"
        logger.error(f"Upload error: {e}")
        return "error"


def upload_all_votes(input_file: str | Path | None = None, batch_size=100):
    """
    Upload all processed votes to Supabase.

    Args:
        input_file: Path to processed votes JSON
        batch_size: Show progress every N votes
    """
    start_time = datetime.now()
    input_path = Path(input_file) if input_file else (DATA_DIR / "processed_votes.json")

    logger.info(f"Loading processed votes from {input_path}")

    with open(input_path, 'r', encoding='utf-8') as f:
        votes = json.load(f)

    logger.info(f"Found {len(votes)} processed votes")
    logger.info("Starting upload to Supabase...")

    uploaded = 0
    backfilled = 0
    duplicates = 0
    unknown_voters = 0
    errors = 0

    # Phase 1.5: Track meeting match statistics
    meeting_stats = {
        'meetings_matched': 0,
        'with_calendar_url': 0,
        'with_agenda_url': 0,
        'with_minutes_url': 0
    }

    # Track link coverage for all source types
    link_coverage = {
        'source_api_url': 0,
        'source_portal_url': 0,
        'source_hash': 0
    }

    for i, vote in enumerate(votes, 1):
        if i % batch_size == 0:
            logger.info(
                f"Progress: {i}/{len(votes)} ("
                f"{uploaded} uploaded, {backfilled} backfilled, {duplicates} duplicates, {unknown_voters} unknown voters)"
            )

        result = upload_vote(vote, stats=meeting_stats)

        # Track link coverage
        if vote.get('source_api_url'):
            link_coverage['source_api_url'] += 1
        if vote.get('source_portal_url'):
            link_coverage['source_portal_url'] += 1
        if vote.get('source_hash'):
            link_coverage['source_hash'] += 1

        if result == "uploaded":
            uploaded += 1
        elif result == "backfilled":
            backfilled += 1
        elif result == "duplicate":
            duplicates += 1
        elif result == "unknown_voter":
            unknown_voters += 1
        else:
            errors += 1

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()

    # Get candidate vote counts
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
    total_uploaded = uploaded + duplicates  # Include duplicates in total for match rate
    meeting_match_rate = (meeting_stats['meetings_matched'] / total_uploaded * 100) if total_uploaded > 0 else 0

    # Calculate link coverage percentages
    def calc_coverage_pct(count, total):
        return f"{count:,}/{total:,} ({count/total*100:.1f}%)" if total > 0 else "N/A"

    # Print summary
    stats = {
        "Started": start_time.strftime("%Y-%m-%d %H:%M:%S"),
        "Completed": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Duration": format_duration(duration),
        "": "",
        "Total votes processed": f"{len(votes):,}",
        "Uploaded successfully": f"{uploaded:,} ({uploaded/len(votes)*100:.1f}%)",
        "Backfilled updates": f"{backfilled:,} ({backfilled/len(votes)*100:.1f}%)",
        "Skipped (duplicates)": f"{duplicates:,} ({duplicates/len(votes)*100:.1f}%)",
        "Skipped (unknown voters)": f"{unknown_voters:,} ({unknown_voters/len(votes)*100:.1f}%)",
        "Errors": f"{errors:,} ({errors/len(votes)*100:.1f}%)",
        " ": "",
        "Phase 1: Source Link Coverage": {
            "source_api_url": calc_coverage_pct(link_coverage['source_api_url'], len(votes)),
            "source_portal_url": calc_coverage_pct(link_coverage['source_portal_url'], len(votes)),
            "source_hash": calc_coverage_pct(link_coverage['source_hash'], len(votes))
        },
        "  ": "",
        "Phase 1.5: Meeting Links": {
            "Votes matched to meetings": f"{meeting_stats['meetings_matched']:,} ({meeting_match_rate:.1f}%)",
            "With calendar event URL": f"{meeting_stats['with_calendar_url']:,}",
            "With agenda URL": f"{meeting_stats['with_agenda_url']:,}",
            "With minutes URL": f"{meeting_stats['with_minutes_url']:,}",
        },
        "   ": "",
        "Votes in database by candidate": candidate_stats if candidate_stats else "Could not fetch",
        "    ": "",
        "Database URL": SUPABASE_URL,
        "Log file": str(DATA_DIR / "upload.log"),
        "     ": "",
        "Verification": "Run 'python verify_sources.py' to validate links"
    }

    print_summary_box("UPLOAD SUMMARY", stats)

    logger.info("Upload complete!")


def clear_all_votes():
    """
    DANGER: Delete all votes from Supabase.
    Only use for testing/reset.
    """
    confirm = input("⚠️  This will DELETE ALL VOTES. Type 'DELETE' to confirm: ")
    if confirm != "DELETE":
        logger.info("Clear operation cancelled.")
        return

    if not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("Refusing to delete without SUPABASE_SERVICE_ROLE_KEY. This operation requires service role privileges.")
        return

    try:
        supabase.table("votes").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        logger.info("✓ Deleted all votes")
    except Exception as e:
        logger.error(f"Error deleting votes: {e}")
        logger.info("Note: Ensure your service role key is correct and that RLS allows delete or run from dashboard.")


if __name__ == "__main__":
    import sys

    logger.info("CivicCheckYYC - Supabase Uploader")
    logger.info("=" * 60)

    try:
        if "--clear" in sys.argv:
            clear_all_votes()
        else:
            upload_all_votes()

        logger.info("\n✓ Done! Your votes are now in Supabase.")
        logger.info("Next step: Set up the Next.js frontend to display them.")
    except Exception as e:
        logger.error(f"\n✗ Fatal error: {e}", exc_info=True)
        sys.exit(1)
