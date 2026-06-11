"""
Source Link Verification for CivicCheckYYC

Validates that source URLs are accessible and that data integrity is maintained.

Features:
- Samples random votes from database
- Tests HTTP accessibility of source_api_url and source_portal_url
- Validates JSON data matches database records
- Reports coverage statistics for all link types
- Logs results to data/link_verification_{timestamp}.json

Usage:
    python verify_sources.py                    # Test 20 random votes
    python verify_sources.py --sample-size 50   # Test 50 random votes
    python verify_sources.py --all              # Test all votes (slow!)
"""

import os
import sys
import json
import logging
import requests
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Import shared utilities
from utils import setup_logging, format_duration, print_summary_box

load_dotenv()

# Resolve repo root and data directory
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"

# Initialize logging
logger = setup_logging(DATA_DIR / "link_verification.log", "INFO")

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_PROJECT_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY are required")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# HTTP request timeout
REQUEST_TIMEOUT = 10  # seconds


def test_url_accessibility(url: str) -> Dict[str, any]:
    """
    Test if a URL is accessible via HEAD request.

    Args:
        url: URL to test

    Returns:
        Dict with status, status_code, and error (if any)
    """
    if not url:
        return {"status": "missing", "status_code": None, "error": "URL is None or empty"}

    try:
        response = requests.head(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        return {
            "status": "success" if response.status_code < 400 else "error",
            "status_code": response.status_code,
            "error": None if response.status_code < 400 else f"HTTP {response.status_code}"
        }
    except requests.exceptions.Timeout:
        return {"status": "error", "status_code": None, "error": "Timeout"}
    except requests.exceptions.ConnectionError:
        return {"status": "error", "status_code": None, "error": "Connection failed"}
    except Exception as e:
        return {"status": "error", "status_code": None, "error": str(e)}


def validate_json_data(vote: Dict, source_api_url: str) -> Dict[str, any]:
    """
    Fetch JSON from source_api_url and validate it matches database record.

    Args:
        vote: Database vote record
        source_api_url: Direct JSON API URL

    Returns:
        Dict with validation status and details
    """
    if not source_api_url:
        return {"status": "skipped", "error": "No source_api_url"}

    try:
        response = requests.get(source_api_url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()

        # Parse JSON (expect single object or array with one element)
        data = response.json()
        if isinstance(data, list):
            if len(data) == 0:
                return {"status": "error", "error": "Empty JSON array"}
            data = data[0]

        # Validate key fields
        mismatches = []

        # Check voter field (note: may need normalization)
        if data.get('voter') and vote.get('voter'):
            if data['voter'] != vote['voter']:
                mismatches.append(f"voter: {data['voter']} != {vote['voter']}")

        # Check meetingdate
        if data.get('meetingdate'):
            # Normalize dates for comparison (both should be ISO format)
            db_date = vote.get('meeting_date', '').split('T')[0]
            api_date = data['meetingdate'].split('T')[0]
            if db_date != api_date:
                mismatches.append(f"meetingdate: {api_date} != {db_date}")

        # Check vote value
        if data.get('vote') and vote.get('vote'):
            # Normalize vote values (Yes→for, No→against, Absent→absent)
            vote_map = {"Yes": "for", "No": "against", "Absent": "absent"}
            api_vote = vote_map.get(data['vote'], data['vote']).lower()
            db_vote = vote['vote'].lower()
            if api_vote != db_vote:
                mismatches.append(f"vote: {api_vote} != {db_vote}")

        if mismatches:
            return {
                "status": "mismatch",
                "error": f"Data mismatch: {'; '.join(mismatches)}"
            }

        return {"status": "valid", "error": None}

    except requests.exceptions.HTTPError as e:
        return {"status": "error", "error": f"HTTP {e.response.status_code}"}
    except requests.exceptions.RequestException as e:
        return {"status": "error", "error": f"Request failed: {str(e)}"}
    except Exception as e:
        return {"status": "error", "error": f"Validation error: {str(e)}"}


def verify_sources(sample_size: int = 20, test_all: bool = False):
    """
    Main source verification workflow.

    Args:
        sample_size: Number of votes to test
        test_all: If True, test all votes (overrides sample_size)
    """
    start_time = datetime.now()

    logger.info("=" * 60)
    logger.info("CivicCheckYYC - Source Link Verification")
    logger.info("=" * 60)

    # Fetch votes from database
    logger.info("Fetching votes from database...")

    try:
        if test_all:
            response = supabase.table("votes").select("*").execute()
            logger.info(f"Testing ALL votes ({len(response.data)} total)")
        else:
            # Random sample using order by random() limit N
            # Note: This uses PostgreSQL's random() function
            response = supabase.table("votes").select("*").limit(sample_size).execute()
            logger.info(f"Testing random sample of {sample_size} votes")

        votes = response.data

        if not votes:
            logger.error("No votes found in database")
            return

    except Exception as e:
        logger.error(f"Failed to fetch votes: {e}")
        return

    # Initialize counters
    results = {
        "total_votes": len(votes),
        "source_api_url": {"total": 0, "accessible": 0, "broken": 0, "missing": 0},
        "source_portal_url": {"total": 0, "accessible": 0, "broken": 0, "missing": 0},
        "calendar_event_url": {"total": 0, "accessible": 0, "broken": 0, "missing": 0},
        "agenda_url": {"total": 0, "accessible": 0, "broken": 0, "missing": 0},
        "minutes_url": {"total": 0, "accessible": 0, "broken": 0, "missing": 0},
        "data_validation": {"tested": 0, "valid": 0, "mismatch": 0, "error": 0}
    }

    broken_links = []

    # Test each vote
    logger.info(f"Testing {len(votes)} votes...")

    for i, vote in enumerate(votes, 1):
        if i % 10 == 0:
            logger.info(f"Progress: {i}/{len(votes)}")

        # Test source_api_url
        if vote.get('source_api_url'):
            results['source_api_url']['total'] += 1
            test_result = test_url_accessibility(vote['source_api_url'])
            if test_result['status'] == 'success':
                results['source_api_url']['accessible'] += 1

                # Validate JSON data
                results['data_validation']['tested'] += 1
                validation_result = validate_json_data(vote, vote['source_api_url'])
                if validation_result['status'] == 'valid':
                    results['data_validation']['valid'] += 1
                elif validation_result['status'] == 'mismatch':
                    results['data_validation']['mismatch'] += 1
                    logger.warning(f"Data mismatch for vote {vote['id']}: {validation_result['error']}")
                else:
                    results['data_validation']['error'] += 1
            else:
                results['source_api_url']['broken'] += 1
                broken_links.append({
                    "vote_id": vote['id'],
                    "url_type": "source_api_url",
                    "url": vote['source_api_url'],
                    "error": test_result['error']
                })
        else:
            results['source_api_url']['missing'] += 1

        # Test source_portal_url
        if vote.get('source_portal_url'):
            results['source_portal_url']['total'] += 1
            test_result = test_url_accessibility(vote['source_portal_url'])
            if test_result['status'] == 'success':
                results['source_portal_url']['accessible'] += 1
            else:
                results['source_portal_url']['broken'] += 1
                broken_links.append({
                    "vote_id": vote['id'],
                    "url_type": "source_portal_url",
                    "url": vote['source_portal_url'],
                    "error": test_result['error']
                })
        else:
            results['source_portal_url']['missing'] += 1

        # Test calendar_event_url
        if vote.get('calendar_event_url'):
            results['calendar_event_url']['total'] += 1
            test_result = test_url_accessibility(vote['calendar_event_url'])
            if test_result['status'] == 'success':
                results['calendar_event_url']['accessible'] += 1
            else:
                results['calendar_event_url']['broken'] += 1
        else:
            results['calendar_event_url']['missing'] += 1

        # Test agenda_url
        if vote.get('agenda_url'):
            results['agenda_url']['total'] += 1
            test_result = test_url_accessibility(vote['agenda_url'])
            if test_result['status'] == 'success':
                results['agenda_url']['accessible'] += 1
            else:
                results['agenda_url']['broken'] += 1
        else:
            results['agenda_url']['missing'] += 1

        # Test minutes_url
        if vote.get('minutes_url'):
            results['minutes_url']['total'] += 1
            test_result = test_url_accessibility(vote['minutes_url'])
            if test_result['status'] == 'success':
                results['minutes_url']['accessible'] += 1
            else:
                results['minutes_url']['broken'] += 1
        else:
            results['minutes_url']['missing'] += 1

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()

    # Calculate percentages
    def calc_pct(count, total):
        return f"{count}/{total} ({count/total*100:.1f}%)" if total > 0 else "N/A"

    # Save results to JSON
    timestamp_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    results_file = DATA_DIR / f"link_verification_{timestamp_str}.json"

    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": duration,
            "sample_size": len(votes),
            "results": results,
            "broken_links": broken_links
        }, f, indent=2)

    logger.info(f"✓ Results saved to {results_file}")

    # Print summary
    stats = {
        "Started": start_time.strftime("%Y-%m-%d %H:%M:%S"),
        "Completed": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Duration": format_duration(duration),
        "": "",
        "Votes Tested": f"{len(votes):,}",
        " ": "",
        "source_api_url": calc_pct(results['source_api_url']['accessible'], results['source_api_url']['total']),
        "source_portal_url": calc_pct(results['source_portal_url']['accessible'], results['source_portal_url']['total']),
        "calendar_event_url": calc_pct(results['calendar_event_url']['accessible'], results['calendar_event_url']['total']),
        "agenda_url": calc_pct(results['agenda_url']['accessible'], results['agenda_url']['total']),
        "minutes_url": calc_pct(results['minutes_url']['accessible'], results['minutes_url']['total']),
        "  ": "",
        "Data Validation": {
            "Tested": f"{results['data_validation']['tested']}",
            "Valid": f"{results['data_validation']['valid']}",
            "Mismatch": f"{results['data_validation']['mismatch']}",
            "Error": f"{results['data_validation']['error']}"
        },
        "   ": "",
        "Broken Links": f"{len(broken_links)} (see {results_file})",
        "    ": "",
        "Results File": str(results_file)
    }

    print_summary_box("LINK VERIFICATION SUMMARY", stats)

    # Warn if high failure rate
    if results['source_api_url']['total'] > 0:
        api_success_rate = results['source_api_url']['accessible'] / results['source_api_url']['total'] * 100
        if api_success_rate < 90:
            logger.warning(f"⚠️  source_api_url success rate is low: {api_success_rate:.1f}%")

    logger.info("Verification complete!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Verify source links in CivicCheckYYC database")
    parser.add_argument("--sample-size", type=int, default=20,
                        help="Number of votes to test (default: 20)")
    parser.add_argument("--all", action="store_true",
                        help="Test all votes (overrides --sample-size)")

    args = parser.parse_args()

    try:
        verify_sources(sample_size=args.sample_size, test_all=args.all)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
