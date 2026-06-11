"""
Deduplicate motions in the database.

Problem: Same council motion appears multiple times with different AI-generated summaries.
Safer solution: Group motions by the original resolution text + meeting_date and consolidate
only those true duplicates. Do NOT merge items solely by report number, as amendments often
share report numbers and dates but are distinct motions.
"""

import os
import logging
from collections import defaultdict
import re
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_PROJECT_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY required")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _normalize_resolution(text: str) -> str:
    """Create a conservative normalization of the resolution text for grouping.
    Collapse whitespace and lowercase, but avoid aggressive transformations to reduce false merges.
    """
    if not text:
        return ""
    collapsed = re.sub(r"\s+", " ", text).strip()
    return collapsed.lower()


def find_duplicate_motions():
    """
    Find duplicate motions by grouping on normalized resolution text + meeting_date.

    Returns:
        dict: {(normalized_resolution, date): [motion_records]}
    """
    logger.info("Fetching all motions...")

    # Fetch all motions
    response = supabase.table("motions").select("*").execute()
    motions = response.data

    logger.info(f"Found {len(motions)} total motions")

    # Group by normalized resolution + meeting_date (safer than report_numbers)
    groups = defaultdict(list)

    for motion in motions:
        meeting_date = motion.get('meeting_date')
        norm_res = _normalize_resolution(motion.get('resolution') or "")
        key = (norm_res, meeting_date)
        groups[key].append(motion)

    # Filter to only groups with duplicates
    duplicates = {k: v for k, v in groups.items() if len(v) > 1}

    logger.info(f"Found {len(duplicates)} duplicate groups (by resolution+date)")

    return duplicates, []


def choose_canonical_motion(motion_group):
    """
    Choose which motion to keep from a duplicate group.

    Strategy:
    1. Prefer motion with most votes linked
    2. If tied, prefer longest motion_summary
    3. If tied, prefer earliest created_at

    Args:
        motion_group: List of duplicate motions

    Returns:
        tuple: (canonical_motion, motions_to_delete)
    """
    # Get vote counts for each motion
    motion_with_counts = []

    for motion in motion_group:
        vote_response = supabase.table("votes")\
            .select("id", count="exact")\
            .eq("motion_id", motion['id'])\
            .execute()

        vote_count = vote_response.count if hasattr(vote_response, 'count') else 0

        motion_with_counts.append({
            'motion': motion,
            'vote_count': vote_count,
            'summary_length': len(motion.get('motion_summary') or ''),
            'created_at': motion.get('created_at')
        })

    # Sort by: vote_count (desc), summary_length (desc), created_at (asc)
    motion_with_counts.sort(
        key=lambda x: (-x['vote_count'], -x['summary_length'], x['created_at'])
    )

    canonical = motion_with_counts[0]['motion']
    to_delete = [m['motion'] for m in motion_with_counts[1:]]

    return canonical, to_delete


def deduplicate_motions(dry_run=True):
    """
    Deduplicate motions in the database.

    Args:
        dry_run: If True, only report what would be done without making changes
    """
    logger.info("=" * 60)
    logger.info("MOTION DEDUPLICATION")
    logger.info("=" * 60)

    if dry_run:
        logger.info("DRY RUN MODE - No changes will be made")
    else:
        logger.warning("LIVE MODE - Changes will be made to database!")

    logger.info("")

    # Find duplicates
    duplicate_groups, no_reports = find_duplicate_motions()

    if len(duplicate_groups) == 0:
        logger.info("✓ No duplicates found!")
        return

    # Process each duplicate group
    total_deleted = 0
    total_votes_updated = 0

    for (key, date), motions in duplicate_groups.items():
        logger.info("")
        logger.info("-" * 60)
        logger.info(f"Duplicate group: <resolution_hash> on {date}")
        logger.info(f"  Found {len(motions)} duplicate motions")

        # Choose canonical
        canonical, to_delete = choose_canonical_motion(motions)

        logger.info(f"  Canonical motion ID: {canonical['id']}")
        logger.info(f"    Summary: {canonical['motion_summary'][:80]}...")
        logger.info(f"  Will delete {len(to_delete)} duplicates:")

        # Process each duplicate
        for dup in to_delete:
            logger.info(f"    - {dup['id']}: {dup['motion_summary'][:60]}...")

            # Count votes to update
            vote_response = supabase.table("votes")\
                .select("id", count="exact")\
                .eq("motion_id", dup['id'])\
                .execute()

            vote_count = vote_response.count if hasattr(vote_response, 'count') else 0
            logger.info(f"      Votes to update: {vote_count}")

            if not dry_run:
                # SAFETY: Only update if resolutions actually match exactly (extra guard)
                if (dup.get('resolution') or '') != (canonical.get('resolution') or ''):
                    logger.warning("      Skipping vote relink due to different resolution text")
                    continue
                # Update votes to point to canonical motion
                if vote_count > 0:
                    supabase.table("votes")\
                        .update({"motion_id": canonical['id']})\
                        .eq("motion_id", dup['id'])\
                        .execute()

                    total_votes_updated += vote_count
                    logger.info(f"      ✓ Updated {vote_count} votes")

                # Delete duplicate motion
                supabase.table("motions")\
                    .delete()\
                    .eq("id", dup['id'])\
                    .execute()

                total_deleted += 1
                logger.info(f"      ✓ Deleted motion")

    # Print summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Duplicate groups found: {len(duplicate_groups)}")
    if no_reports is not None:
        logger.info(f"Motions without report numbers: {len(no_reports)}")

    if not dry_run:
        logger.info(f"Motions deleted: {total_deleted}")
        logger.info(f"Votes updated: {total_votes_updated}")
        logger.info("")
        logger.info("✓ Deduplication complete!")
    else:
        logger.info("")
        logger.info("Run with --execute flag to apply changes")


if __name__ == "__main__":
    import sys

    dry_run = "--execute" not in sys.argv

    try:
        deduplicate_motions(dry_run=dry_run)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        sys.exit(1)
