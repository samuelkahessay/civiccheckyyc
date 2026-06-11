"""
Async AI processor with caching, resume, and checkpointing.

Goals
- Keep the fast async pipeline (semaphore concurrency).
- Add durable caching keyed by source_hash + prompt_version.
- Add robust resume + checkpoint saves to avoid rework.
- Add primary→fallback model handling (gpt-5-mini → gpt-5-nano).
- Keep output format compatible with existing uploader (list of votes).

Usage
  python backend/ai_processor_async_cached.py            # full run
  python backend/ai_processor_async_cached.py --resume   # resume from checkpoint
  python backend/ai_processor_async_cached.py --test     # first 100 votes
  python backend/ai_processor_async_cached.py --sample   # representative sample in test mode
  python backend/ai_processor_async_cached.py --rebuild  # ignore cache and reprocess
"""

from __future__ import annotations

import os
import json
import logging
import asyncio
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from openai import (
    AsyncOpenAI,
    RateLimitError,
    APIError,
    APIConnectionError,
    APITimeoutError,
)

# Shared config and utilities
from config import (
    PROMPT_VERSION,
    AI_MAX_TOKENS,
    AI_TEMPERATURE,
    AI_TIMEOUT,
    LOG_LEVEL,
    CHECKPOINT_INTERVAL,
    CONCURRENT_REQUESTS,
    ASYNC_BATCH_CHECKPOINT_SIZE,
    VALID_TOPICS,
    VOTE_IMPACT_LEVELS,
    MOTION_TITLE_MAX_LENGTH,
    get_model_version,
)
from utils import (
    async_retry_with_backoff,
    CheckpointManager,
    setup_logging,
    format_duration,
    print_summary_box,
)

# Reuse prompt/utilities from sync processor to ensure parity
from ai_processor import (
    load_prompt_template,
    extract_report_numbers,
    create_representative_sample,
    save_progress as save_progress_list,
)

# Model names and validation come from sync processor
from ai_processor import PRIMARY_MODEL, FALLBACK_MODEL


# --------------------------------------------------------------------------------------
# Paths and setup
# --------------------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"

# Files (v2 to avoid clobbering older runs; uploader still consumes processed_votes.json)
RAW_VOTES_FILE = DATA_DIR / "raw_votes.json"
PROCESSED_VOTES_FILE = DATA_DIR / "processed_votes.json"  # keep same to stay compatible
CHECKPOINT_FILE = DATA_DIR / "checkpoint_ai_processing_v2.json"
CACHE_JSONL_FILE = DATA_DIR / "ai_processing_cache.jsonl"

load_dotenv()

# Logging
logger = setup_logging(DATA_DIR / "processing_async_cached.log", LOG_LEVEL)

# Async OpenAI client
async_client = AsyncOpenAI(api_key=os.getenv("OPENAI_KEY"))

# Load versioned prompt once
PROCESSING_PROMPT = load_prompt_template()


# --------------------------------------------------------------------------------------
# Cache helpers
# --------------------------------------------------------------------------------------
def _make_cache_key(source_hash: str, prompt_version: str = PROMPT_VERSION) -> str:
    """Stable cache key based on source content and prompt version."""
    base = f"{source_hash}|{prompt_version}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def _load_cache_jsonl(path: Path) -> Dict[str, Dict[str, Any]]:
    """Load JSONL cache into memory as a dict: key -> payload."""
    cache: Dict[str, Dict[str, Any]] = {}
    if not path.exists():
        return cache
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    key = obj.get("key")
                    if key:
                        cache[key] = obj
                except json.JSONDecodeError:
                    # Skip malformed lines, keep going
                    continue
    except Exception as e:
        logger.warning(f"Failed to load cache: {e}")
    return cache


def _append_cache_jsonl(path: Path, key: str, payload: Dict[str, Any]) -> None:
    """Append a single cache record to the JSONL file (best-effort)."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        record = json.dumps({"key": key, **payload}, ensure_ascii=False)
        with open(path, "a", encoding="utf-8") as f:
            f.write(record + "\n")
    except Exception as e:
        logger.debug(f"Cache append failed (non-fatal): {e}")


# --------------------------------------------------------------------------------------
# Validation helpers
# --------------------------------------------------------------------------------------
def _validate_ai_result(obj: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and normalize AI JSON result."""
    required_fields = ["motion_title", "motion_summary", "topic", "impact"]
    missing = [k for k in required_fields if k not in obj]
    if missing:
        raise ValueError(f"Missing required fields: {missing}")

    # Types and enums
    if not isinstance(obj["motion_title"], str):
        raise ValueError("motion_title must be a string")
    if not isinstance(obj["motion_summary"], str):
        raise ValueError("motion_summary must be a string")

    topic = obj.get("topic")
    if topic not in VALID_TOPICS:
        logger.warning(f"Invalid topic '{topic}', defaulting to 'Other'")
        obj["topic"] = "Other"

    impact = obj.get("impact")
    if impact not in VOTE_IMPACT_LEVELS:
        logger.warning(f"Invalid impact '{impact}', defaulting to 'medium'")
        obj["impact"] = "medium"

    # Enforce title length
    if len(obj["motion_title"]) > MOTION_TITLE_MAX_LENGTH:
        original_length = len(obj["motion_title"])
        obj["motion_title"] = (
            obj["motion_title"][:MOTION_TITLE_MAX_LENGTH].rsplit(" ", 1)[0] + "..."
        )
        logger.warning(
            f"Motion title truncated from {original_length} to {MOTION_TITLE_MAX_LENGTH} chars"
        )

    return obj


# --------------------------------------------------------------------------------------
# OpenAI call with fallback
# --------------------------------------------------------------------------------------
@async_retry_with_backoff(
    exceptions=(RateLimitError, APIError, APIConnectionError, APITimeoutError),
)
async def _ask_openai_json(resolution_text: str, model: str) -> Tuple[Dict[str, Any], Optional[int]]:
    prompt = PROCESSING_PROMPT.format(resolution=resolution_text[:3000])
    response = await async_client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant that processes government documents into plain language. Always return valid JSON.",
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=AI_TEMPERATURE,
        max_completion_tokens=AI_MAX_TOKENS,
        timeout=AI_TIMEOUT,
    )

    choice = response.choices[0]
    result_text = choice.message.content
    if not result_text:
        raise ValueError(f"Empty response from AI (finish_reason: {choice.finish_reason})")

    result_text = result_text.strip()
    # Remove markdown fences if present
    if result_text.startswith("```json"):
        result_text = result_text.replace("```json", "").replace("```", "").strip()
    elif result_text.startswith("```"):
        result_text = result_text.replace("```", "").strip()

    obj = json.loads(result_text)
    obj = _validate_ai_result(obj)

    tokens = None
    if hasattr(response, "usage") and response.usage:
        tokens = response.usage.completion_tokens

    return obj, tokens


async def _process_with_fallback(resolution_text: str) -> Tuple[Dict[str, Any], str, Optional[int]]:
    """Try primary model first, then fallback; return (result, model_used, tokens)."""
    try:
        res, tokens = await _ask_openai_json(resolution_text, model=PRIMARY_MODEL)
        return res, PRIMARY_MODEL, tokens
    except Exception as e:
        logger.warning(f"Primary model failed, trying fallback ({FALLBACK_MODEL}): {e}")
        res, tokens = await _ask_openai_json(resolution_text, model=FALLBACK_MODEL)
        return res, FALLBACK_MODEL, tokens


# --------------------------------------------------------------------------------------
# Batch processing
# --------------------------------------------------------------------------------------
async def _process_vote_record(
    index: int,
    vote: Dict[str, Any],
    semaphore: asyncio.Semaphore,
    cache_map: Dict[str, Dict[str, Any]],
    processed_by_hash: Dict[str, Dict[str, Any]],
    rebuild: bool,
    stats: Dict[str, int],
) -> Optional[Tuple[str, Dict[str, Any]]]:
    """Process a single vote; returns (source_hash, processed_vote) or None on skip/error."""
    async with semaphore:
        source_hash = vote.get("source_hash")
        resolution = vote.get("resolution", "")
        if not resolution:
            logger.warning(f"Skipping vote {index}: No resolution text")
            stats["skipped_no_resolution"] += 1
            return None

        if not source_hash:
            # Fallback: compute a quick hash if missing
            raw = f"{vote.get('voter','')}|{vote.get('meetingdate','')}|{resolution}|{vote.get('vote','')}"
            source_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()

        cache_key = _make_cache_key(source_hash)

        # 1) If we already have a processed row for this source_hash with the current prompt, skip
        existing = processed_by_hash.get(source_hash)
        if existing and not rebuild and existing.get("prompt_version") == PROMPT_VERSION:
            stats["resume_hits"] += 1
            return source_hash, existing

        # 2) Try cache map
        if not rebuild and cache_key in cache_map:
            payload = cache_map[cache_key]
            ai_obj = payload.get("ai_obj", {})
            model_used = payload.get("model_used", PRIMARY_MODEL)
            tokens = payload.get("ai_response_tokens")
            stats["cache_hits"] += 1
        else:
            # 3) Call OpenAI with fallback
            try:
                ai_obj, model_used, tokens = await _process_with_fallback(resolution)
            except Exception as e:
                logger.error(f"Error processing vote {index}: {e}")
                stats["errors"] += 1
                return None

            # Append to cache (best-effort)
            _append_cache_jsonl(
                CACHE_JSONL_FILE,
                cache_key,
                {
                    "ai_obj": ai_obj,
                    "model_used": model_used,
                    "prompt_version": PROMPT_VERSION,
                    "ai_response_tokens": tokens,
                },
            )

        # Attribution and provenance
        report_numbers = extract_report_numbers(resolution)
        processed_at = datetime.now().isoformat()

        processed_vote = {
            **vote,
            **ai_obj,
            "ai_model_used": model_used,
            "model_version": get_model_version(model_used),
            "prompt_version": PROMPT_VERSION,
            "processed_at": processed_at,
            "ai_response_tokens": tokens,
            "report_numbers": report_numbers,
        }

        logger.info(f"  ✓ [{index+1}] {ai_obj['motion_title'][:60]}...")

        return source_hash, processed_vote


async def process_all_votes_async_cached(
    input_file: Optional[Path | str] = None,
    output_file: Optional[Path | str] = None,
    batch_size: int = ASYNC_BATCH_CHECKPOINT_SIZE,
    max_votes: Optional[int] = None,
    resume: bool = False,
    representative_sample: bool = False,
    concurrency: int = CONCURRENT_REQUESTS,
    rebuild: bool = False,
) -> List[Dict[str, Any]]:
    start_time = datetime.now()

    input_path = Path(input_file) if input_file else RAW_VOTES_FILE
    output_path = Path(output_file) if output_file else PROCESSED_VOTES_FILE
    checkpoint = CheckpointManager(CHECKPOINT_FILE, interval=batch_size)

    logger.info(f"Loading raw votes from {input_path}")
    with open(input_path, "r", encoding="utf-8") as f:
        raw_votes: List[Dict[str, Any]] = json.load(f)

    # Test slicing / sampling
    if max_votes:
        if representative_sample:
            raw_votes = create_representative_sample(raw_votes, max_votes)
            logger.info(f"Test mode: Processing representative sample of {max_votes} votes")
        else:
            raw_votes = raw_votes[:max_votes]
            logger.info(f"Test mode: Processing first {max_votes} votes")
    else:
        logger.info(f"Processing {len(raw_votes)} votes with {concurrency} concurrent requests")

    # Load existing processed votes (to preserve and avoid duplicates)
    processed_by_hash: Dict[str, Dict[str, Any]] = {}
    if output_path.exists():
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                existing_list = json.load(f)
            for row in existing_list:
                sh = row.get("source_hash")
                if sh and sh not in processed_by_hash:
                    processed_by_hash[sh] = row
        except Exception as e:
            logger.warning(f"Failed to load existing processed votes: {e}")

    # Load JSONL cache
    cache_map = _load_cache_jsonl(CACHE_JSONL_FILE)
    logger.info(f"Cache entries loaded: {len(cache_map)}")

    # Resume support
    start_index = 0
    processed_hashes = set(processed_by_hash.keys())
    if resume and checkpoint.exists():
        cp = checkpoint.load()
        if cp:
            start_index = cp.get("last_processed_index", 0) + 1
            # Merge checkpoint processed hashes with loaded ones
            for h in cp.get("processed_hashes", []):
                processed_hashes.add(h)
            logger.info(f"Resuming from checkpoint at index {start_index}")

    # Build list of tasks to process (skip those already processed with current prompt if not rebuilding)
    votes_to_process: List[Tuple[int, Dict[str, Any]]] = []
    for i, vote in enumerate(raw_votes[start_index:], start=start_index):
        source_hash = vote.get("source_hash")
        if source_hash and (not rebuild):
            existing = processed_by_hash.get(source_hash)
            if existing and existing.get("prompt_version") == PROMPT_VERSION:
                continue  # already done for this prompt
        votes_to_process.append((i, vote))

    total_to_process = len(votes_to_process)
    logger.info(
        f"Processing {total_to_process} votes (skipping {len(raw_votes) - total_to_process} already processed)"
    )

    semaphore = asyncio.Semaphore(concurrency)

    # Stats
    stats = {
        "errors": 0,
        "cache_hits": 0,
        "resume_hits": 0,
        "skipped_no_resolution": 0,
    }

    # Process in batches with checkpointing
    for batch_start in range(0, len(votes_to_process), batch_size):
        batch_end = min(batch_start + batch_size, len(votes_to_process))
        batch = votes_to_process[batch_start:batch_end]
        logger.info(f"Processing batch {batch_start}-{batch_end} of {total_to_process}")

        results = await asyncio.gather(
            *[
                _process_vote_record(
                    idx, vote, semaphore, cache_map, processed_by_hash, rebuild, stats
                )
                for idx, vote in batch
            ],
            return_exceptions=True,
        )

        for res in results:
            if isinstance(res, Exception):
                logger.error(f"Unhandled exception in batch: {res}")
                stats["errors"] += 1
                continue
            if not res:
                continue
            source_hash, processed_vote = res
            # Upsert by source_hash (prevents duplicates on rewrite)
            processed_by_hash[source_hash] = processed_vote
            processed_hashes.add(source_hash)

        # Save checkpoint and progress
        last_index = batch[-1][0] if batch else start_index
        checkpoint.save(
            {
                "last_processed_index": last_index,
                "processed_hashes": list(processed_hashes),
                "prompt_version": PROMPT_VERSION,
                "stats": {**stats, "processed": len(processed_by_hash)},
            }
        )

        # Persist progress: write deterministic order by meeting_date then voter
        try:
            values = list(processed_by_hash.values())
            values.sort(
                key=lambda v: (v.get("meetingdate", ""), v.get("voter", ""))
            )
            save_progress_list(values, output_path)
            logger.info(f"💾 Checkpoint saved ({len(values)} votes processed)")
        except Exception as e:
            logger.error(f"Failed to save progress: {e}")

    # Finalize
    values = list(processed_by_hash.values())
    values.sort(key=lambda v: (v.get("meetingdate", ""), v.get("voter", "")))
    save_progress_list(values, output_path)
    checkpoint.clear()

    duration = (datetime.now() - start_time).total_seconds()

    # Summary box (reusing existing printer expects counts from file)
    # Build a lightweight summary here
    topics: Dict[str, int] = {}
    impacts: Dict[str, int] = {}
    for row in values:
        topics[row.get("topic", "Other")] = topics.get(row.get("topic", "Other"), 0) + 1
        impacts[row.get("impact", "unknown")] = impacts.get(row.get("impact", "unknown"), 0) + 1

    stats_box = {
        "Started": start_time.strftime("%Y-%m-%d %H:%M:%S"),
        "Completed": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Duration": format_duration(duration),
        "": "",
        "Total raw votes": f"{len(raw_votes):,}",
        "Processed (unique)": f"{len(values):,}",
        "Cache hits": stats["cache_hits"],
        "Resume hits": stats["resume_hits"],
        "Skipped (no resolution)": stats["skipped_no_resolution"],
        "Errors": stats["errors"],
        " ": "",
        "Vote Impact Distribution": impacts,
        "Topics": dict(sorted(topics.items(), key=lambda x: x[1], reverse=True)),
        "  ": "",
        "Output file": str(output_path),
        "Log file": str(DATA_DIR / "processing_async_cached.log"),
        "Cache file": str(CACHE_JSONL_FILE),
        "Checkpoint": str(CHECKPOINT_FILE),
    }
    print_summary_box("ASYNC CACHED PROCESSING SUMMARY", stats_box)

    logger.info("Async cached processing complete!")
    return values


def main() -> None:
    import sys

    logger.info("CivicCheckYYC - AI Processor (Async + Cache)")
    logger.info("=" * 60)

    test_mode = "--test" in sys.argv
    resume_mode = "--resume" in sys.argv
    sample_mode = "--sample" in sys.argv
    rebuild_mode = "--rebuild" in sys.argv
    max_votes = 100 if test_mode else None

    if test_mode:
        if sample_mode:
            logger.warning("⚠ TEST MODE: Representative sample of 100 votes")
        else:
            logger.warning("⚠ TEST MODE: First 100 votes")
        logger.info("Run without --test to process all votes\n")

    if resume_mode:
        logger.info("📂 RESUME MODE: Continue from checkpoint if available\n")

    if rebuild_mode:
        logger.info("♻ REBUILD MODE: Ignoring cache and reprocessing entries\n")

    logger.info(f"Concurrent requests: {CONCURRENT_REQUESTS}")
    logger.info(f"Model (primary): {PRIMARY_MODEL}")
    logger.info(f"Model (fallback): {FALLBACK_MODEL}\n")

    try:
        asyncio.run(
            process_all_votes_async_cached(
                max_votes=max_votes,
                resume=resume_mode,
                representative_sample=sample_mode,
                concurrency=CONCURRENT_REQUESTS,
                rebuild=rebuild_mode,
            )
        )
        logger.info("\n✓ Done! Next step: Run upload_to_supabase.py")
    except KeyboardInterrupt:
        logger.warning("\n⚠ Processing interrupted by user")
        logger.info("  Run with --resume to continue from checkpoint")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n✗ Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

