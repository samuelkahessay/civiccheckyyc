"""
Recover processed votes from Supabase and merge with current processing.
This script pulls votes that were already processed and uploaded to Supabase,
then merges them with the current async processing to avoid duplicate work.
"""

import os
import json
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Resolve paths
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_PROJECT_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Supabase credentials required")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Fetching votes from Supabase...")

# Fetch all votes from Supabase (paginated)
all_votes = []
page_size = 1000
offset = 0

while True:
    response = supabase.table("votes") \
        .select("*") \
        .range(offset, offset + page_size - 1) \
        .execute()

    if not response.data:
        break

    all_votes.extend(response.data)
    print(f"  Fetched {len(all_votes)} votes...")

    if len(response.data) < page_size:
        break

    offset += page_size

print(f"\n✓ Total votes in Supabase: {len(all_votes)}")

# Load raw votes to map back
print("\nLoading raw votes...")
with open(DATA_DIR / "raw_votes.json", 'r') as f:
    raw_votes = json.load(f)

print(f"✓ Loaded {len(raw_votes)} raw votes")

# Create mapping from source_hash to raw vote
raw_by_hash = {v.get("source_hash"): v for v in raw_votes if v.get("source_hash")}

# Load current processed votes (from async)
current_processed_path = DATA_DIR / "processed_votes.json"
if current_processed_path.exists():
    with open(current_processed_path, 'r') as f:
        current_processed = json.load(f)
    print(f"✓ Current async processing: {len(current_processed)} votes")
else:
    current_processed = []
    print("✓ No current processed votes found")

# Create set of hashes already processed by async
current_hashes = {v.get("source_hash") for v in current_processed if v.get("source_hash")}

# Recover votes from Supabase that aren't in current processing
recovered = []
for vote in all_votes:
    source_hash = vote.get("source_hash")

    if not source_hash or source_hash in current_hashes:
        continue

    # Get the original raw vote
    raw_vote = raw_by_hash.get(source_hash)
    if not raw_vote:
        print(f"  Warning: No raw vote found for hash {source_hash[:16]}...")
        continue

    # Reconstruct the processed vote format
    processed_vote = {
        **raw_vote,
        "motion_title": vote.get("motion_title"),
        "motion_summary": vote.get("motion_summary"),
        "topic": vote.get("topic"),
        "impact": vote.get("impact"),
        "ai_model_used": vote.get("ai_model_used", "gpt-5-mini"),
        "model_version": vote.get("model_version"),
        "prompt_version": vote.get("prompt_version"),
        "processed_at": vote.get("processed_at"),
        "ai_response_tokens": vote.get("ai_response_tokens"),
        "report_numbers": vote.get("report_numbers", [])
    }

    recovered.append(processed_vote)

print(f"\n✓ Recovered {len(recovered)} votes from Supabase")
print(f"✓ Current async processed: {len(current_processed)} votes")

# Merge recovered + current
merged = recovered + current_processed
print(f"✓ Total merged: {len(merged)} votes")

# Verify no duplicates
unique_hashes = set()
duplicates = 0
for v in merged:
    h = v.get("source_hash")
    if h:
        if h in unique_hashes:
            duplicates += 1
        unique_hashes.add(h)

print(f"✓ Unique votes: {len(unique_hashes)}")
if duplicates > 0:
    print(f"  Warning: {duplicates} duplicates detected (will be filtered)")

# Filter duplicates (keep first occurrence)
seen = set()
unique_merged = []
for v in merged:
    h = v.get("source_hash")
    if h and h not in seen:
        seen.add(h)
        unique_merged.append(v)

# Save merged file
backup_path = DATA_DIR / "processed_votes_backup.json"
if current_processed_path.exists():
    print(f"\n✓ Backing up current processed votes to {backup_path}")
    with open(backup_path, 'w') as f:
        json.dump(current_processed, f, indent=2, ensure_ascii=False)

print(f"✓ Saving merged votes ({len(unique_merged)} total)")
with open(DATA_DIR / "processed_votes.json", 'w') as f:
    json.dump(unique_merged, f, indent=2, ensure_ascii=False)

# Update checkpoint
checkpoint_path = DATA_DIR / "checkpoint_ai_processing.json"
if checkpoint_path.exists():
    with open(checkpoint_path, 'r') as f:
        checkpoint = json.load(f)

    # Update with merged data
    checkpoint["last_processed_index"] = len(unique_merged) - 1
    checkpoint["processed_vote_ids"] = [
        f"{v.get('voter')}_{v.get('meetingdate')}_{i}"
        for i, v in enumerate(unique_merged)
    ]
    checkpoint["stats"]["processed"] = len(unique_merged)

    with open(checkpoint_path, 'w') as f:
        json.dump(checkpoint, f, indent=2, ensure_ascii=False)

    print(f"✓ Updated checkpoint to index {len(unique_merged) - 1}")

print(f"\n{'='*60}")
print("RECOVERY COMPLETE".center(60))
print(f"{'='*60}")
print(f"Recovered from Supabase: {len(recovered)}")
print(f"Current async processed: {len(current_processed)}")
print(f"Total unique votes: {len(unique_merged)}")
print(f"Remaining to process: {len(raw_votes) - len(unique_merged)}")
print(f"{'='*60}\n")

print("Next steps:")
print("1. Stop the current async processor (if running)")
print("2. Run: python ai_processor_async.py --resume")
print("   (It will skip the recovered votes and continue from where you left off)")
