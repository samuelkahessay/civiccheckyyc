"""
Fetch voting records from Calgary Open Data API
Dataset: Council and Committee Votes (2020-present)
API: https://data.calgary.ca/resource/ruq3-99hx.json

Enhanced with:
- Retry logic with exponential backoff
- Structured logging
- Summary reports
- Full Socrata provenance capture (Phase 1)
- Source hash generation for deduplication
- Timestamped immutable JSON archives
"""

import requests
import json
import logging
import hashlib
from pathlib import Path
from datetime import datetime

# Import shared utilities and config
from config import MAX_RETRIES, RETRY_BASE_DELAY, MAX_RETRY_DELAY
from utils import retry_with_backoff, setup_logging, format_duration, print_summary_box

# Resolve repo root and data directory regardless of CWD
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"

# Initialize logging
logger = setup_logging(DATA_DIR / "fetch.log", "INFO")

# Calgary Open Data API endpoint (Socrata SODA API)
API_BASE_URL = "https://data.calgary.ca/resource/ruq3-99hx.json"

# Candidates who have voting records (current or former councillors)
CANDIDATES_WITH_VOTES = [
    "Jyoti Gondek",
    "Mayor J. Gondek",  # Sometimes listed as this
    "Jeromy Farkas",
    "Jeff Davison",
    "Sonya Sharp"
]


def generate_source_hash(voter, meetingdate, resolution, vote):
    """
    Generate SHA-256 hash for vote deduplication and integrity verification.

    Hash format: sha256(voter|meetingdate|resolution|vote)

    Args:
        voter: Councillor name
        meetingdate: ISO date string
        resolution: Full resolution text
        vote: Vote value (Yes/No/Absent)

    Returns:
        64-character hex string (SHA-256 hash)
    """
    # Create stable hash key
    hash_key = f"{voter}|{meetingdate}|{resolution}|{vote}"
    source_hash = hashlib.sha256(hash_key.encode('utf-8')).hexdigest()
    return source_hash


@retry_with_backoff(
    max_retries=MAX_RETRIES,
    base_delay=RETRY_BASE_DELAY,
    max_delay=MAX_RETRY_DELAY,
    exceptions=(requests.exceptions.RequestException,)
)
def fetch_votes_for_candidate(voter_name, limit=10000, offset=0):
    """
    Fetch votes for a specific councillor from Open Calgary API (with retry logic).

    Now captures full Socrata provenance:
    - :id (row identifier)
    - :created_at (when record was created in Socrata)
    - :updated_at (when record was last updated in Socrata)

    Args:
        voter_name: Name of the councillor
        limit: Max records per request (API limit is usually 50k)
        offset: Offset for pagination

    Returns:
        List of vote records with Socrata system metadata
    """
    params = {
        "$where": f"voter = '{voter_name}'",
        "$limit": limit,
        "$offset": offset,
        "$order": "meetingdate DESC",
        # Include Socrata system metadata for full provenance
        "$select": "*, :id as row_id, :created_at as socrata_created_at, :updated_at as socrata_updated_at"
    }

    response = requests.get(API_BASE_URL, params=params, timeout=30)
    response.raise_for_status()
    data = response.json()

    logger.info(f"Fetched {len(data)} votes for {voter_name}")
    return data


def fetch_all_votes(output_file: str | Path | None = None, save_timestamped_archive=True):
    """
    Fetch all votes for mayoral candidates who have voting records.
    Saves to JSON file for processing.

    Phase 1 enhancements:
    - Adds fetched_at timestamp to each vote
    - Generates source_hash for deduplication
    - Saves timestamped immutable archive (optional)

    Args:
        output_file: Path to save processed votes (default: data/raw_votes.json)
        save_timestamped_archive: Also save immutable timestamped copy (default: True)
    """
    start_time = datetime.now()
    fetch_timestamp = start_time.isoformat()  # Store as ISO string for JSON compatibility
    all_votes = []
    fetch_stats = {}

    logger.info("Starting vote fetch from Calgary Open Data API")
    logger.info(f"Fetch timestamp: {fetch_timestamp}")
    logger.info(f"Target candidates: {', '.join(CANDIDATES_WITH_VOTES)}")

    for candidate in CANDIDATES_WITH_VOTES:
        try:
            votes = fetch_votes_for_candidate(candidate, limit=50000)
            all_votes.extend(votes)
            fetch_stats[candidate] = len(votes)
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch votes for {candidate} after retries: {e}")
            fetch_stats[candidate] = 0

    # Phase 1: Add provenance metadata and generate source hashes
    logger.info("Adding provenance metadata and generating source hashes...")
    hash_collisions = 0
    seen_hashes = set()

    for vote in all_votes:
        # Add fetch timestamp
        vote['fetched_at'] = fetch_timestamp

        # Generate source_hash for deduplication
        source_hash = generate_source_hash(
            voter=vote.get('voter', ''),
            meetingdate=vote.get('meetingdate', ''),
            resolution=vote.get('resolution', ''),
            vote=vote.get('vote', '')
        )
        vote['source_hash'] = source_hash

        # Check for hash collisions (should be extremely rare)
        if source_hash in seen_hashes:
            hash_collisions += 1
            logger.warning(f"Hash collision detected: {source_hash[:16]}... for voter {vote.get('voter')}")
        seen_hashes.add(source_hash)

    if hash_collisions > 0:
        logger.warning(f"Total hash collisions: {hash_collisions} (these are likely true duplicates)")

    # Remove duplicates using source_hash
    unique_votes = []
    seen_hashes_dedup = set()
    duplicates = 0

    for vote in all_votes:
        source_hash = vote.get('source_hash')
        if source_hash and source_hash not in seen_hashes_dedup:
            seen_hashes_dedup.add(source_hash)
            unique_votes.append(vote)
        else:
            duplicates += 1
            logger.debug(f"Duplicate detected via hash: {source_hash[:16]}...")

    logger.info(f"Deduplication: {len(all_votes)} total → {len(unique_votes)} unique ({duplicates} duplicates removed)")

    # Save to working file (gets overwritten each run)
    output_path = Path(output_file) if output_file else (DATA_DIR / "raw_votes.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(unique_votes, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved {len(unique_votes)} votes to {output_path}")

    # Save timestamped immutable archive (for audit trail)
    if save_timestamped_archive:
        timestamp_str = start_time.strftime("%Y-%m-%d_%H-%M-%S")
        archive_path = DATA_DIR / f"archives/raw_votes_{timestamp_str}.json"
        archive_path.parent.mkdir(parents=True, exist_ok=True)

        with open(archive_path, 'w', encoding='utf-8') as f:
            json.dump(unique_votes, f, indent=2, ensure_ascii=False)

        logger.info(f"Saved immutable archive to {archive_path}")

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()

    # Get date range
    dates = [v.get('meetingdate') for v in unique_votes if v.get('meetingdate')]
    date_range = f"{min(dates)} to {max(dates)}" if dates else "N/A"

    # Get meeting type breakdown
    meeting_types = {}
    for vote in unique_votes:
        mtype = vote.get('meetingtype', 'Unknown')
        meeting_types[mtype] = meeting_types.get(mtype, 0) + 1

    # Print summary
    stats = {
        "Started": start_time.strftime("%Y-%m-%d %H:%M:%S"),
        "Completed": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Duration": format_duration(duration),
        "": "",
        "Total fetched": f"{len(all_votes):,}",
        "Unique votes": f"{len(unique_votes):,}",
        "Duplicates removed": f"{duplicates:,}",
        " ": "",
        "By candidate": {name: f"{count:,}" for name, count in sorted(fetch_stats.items(), key=lambda x: x[1], reverse=True)},
        "  ": "",
        "Date range": date_range,
        "Meeting types": len(meeting_types),
        "Top meeting types": {mtype: count for mtype, count in sorted(meeting_types.items(), key=lambda x: x[1], reverse=True)[:5]},
        "   ": "",
        "Output file": str(output_path),
        "Log file": str(DATA_DIR / "fetch.log")
    }

    print_summary_box("FETCH SUMMARY", stats)

    # Show sample vote
    if unique_votes:
        logger.info("Sample vote record:")
        sample = unique_votes[0]
        logger.info(f"  Voter: {sample.get('voter')}")
        logger.info(f"  Meeting: {sample.get('meetingtype')} on {sample.get('meetingdate')}")
        logger.info(f"  Vote: {sample.get('vote')}")
        logger.info(f"  Resolution: {sample.get('resolution', '')[:200]}...")

    return unique_votes


if __name__ == "__main__":
    logger.info("CivicCheckYYC - Vote Fetcher")
    logger.info("="*60)

    try:
        # Fetch all votes
        votes = fetch_all_votes()
        logger.info("\n✓ Done! Next step: Run ai_processor.py to process these votes.")
    except Exception as e:
        logger.error(f"\n✗ Fatal error: {e}", exc_info=True)
        import sys
        sys.exit(1)
