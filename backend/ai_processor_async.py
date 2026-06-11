"""
Async concurrent version of AI processor for CivicCheckYYC.
Processes voting records with GPT-5-mini using async/await for 10-15x speedup.

Features:
- Concurrent processing (15 votes at a time by default)
- Intelligent rate limiting with semaphore
- Full checkpoint/resume compatibility
- Preserves all provenance tracking
- Same output format as ai_processor.py

Usage:
    python ai_processor_async.py --resume  # Resume from checkpoint
    python ai_processor_async.py --test    # Test with 100 votes
"""

import os
import json
import logging
import asyncio
from pathlib import Path
from openai import AsyncOpenAI, RateLimitError, APIError, APIConnectionError, APITimeoutError
from dotenv import load_dotenv
from datetime import datetime

# Import shared utilities and config
from config import *
from utils import async_retry_with_backoff, CheckpointManager, setup_logging, format_duration, print_summary_box
from ai_processor import (
    load_prompt_template,
    extract_report_numbers,
    create_representative_sample,
    save_progress,
    print_summary,
    PROCESSING_PROMPT,
    PROMPT_VERSION,
    PRIMARY_MODEL,
    FALLBACK_MODEL
)

# Resolve repo root and data directory
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"

load_dotenv()

# Initialize logging
logger = setup_logging(DATA_DIR / "processing_async.log", LOG_LEVEL)

# Initialize async OpenAI client
async_client = AsyncOpenAI(api_key=os.getenv("OPENAI_KEY"))


@async_retry_with_backoff(
    max_retries=MAX_RETRIES,
    base_delay=RETRY_BASE_DELAY,
    max_delay=MAX_RETRY_DELAY,
    exceptions=(RateLimitError, APIError, APIConnectionError, APITimeoutError)
)
async def process_vote_with_ai_async(resolution_text, model=PRIMARY_MODEL):
    """
    Async version of process_vote_with_ai.

    Args:
        resolution_text: The raw resolution text from the vote
        model: OpenAI model to use

    Returns:
        dict with motion_title, motion_summary, topic, impact
    """
    prompt = PROCESSING_PROMPT.format(resolution=resolution_text[:3000])

    try:
        # Async API call
        response = await async_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that processes government documents into plain language. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=AI_TEMPERATURE,
            max_completion_tokens=AI_MAX_TOKENS,
            timeout=AI_TIMEOUT
        )

        # Parse response
        choice = response.choices[0]
        logger.debug(f"Response finish_reason: {choice.finish_reason}")

        # Check for refusal
        if hasattr(choice.message, 'refusal') and choice.message.refusal:
            logger.error(f"AI refused to respond: {choice.message.refusal}")
            raise ValueError(f"AI refusal: {choice.message.refusal}")

        result_text = choice.message.content

        if not result_text:
            logger.error(f"AI returned empty response. Finish reason: {choice.finish_reason}")
            raise ValueError(f"Empty response from AI (finish_reason: {choice.finish_reason})")

        result_text = result_text.strip()

        # Remove markdown code blocks if present
        if result_text.startswith("```json"):
            result_text = result_text.replace("```json", "").replace("```", "").strip()
        elif result_text.startswith("```"):
            result_text = result_text.replace("```", "").strip()

        # Parse JSON
        result = json.loads(result_text)

        # Validate required fields
        required_fields = ["motion_title", "motion_summary", "topic", "impact"]
        if not all(k in result for k in required_fields):
            missing = [k for k in required_fields if k not in result]
            raise ValueError(f"Missing required fields in AI response: {missing}")

        # Validate topic
        if result["topic"] not in VALID_TOPICS:
            logger.warning(f"Invalid topic '{result['topic']}', defaulting to 'Other'")
            result["topic"] = "Other"

        # Validate impact
        if result["impact"] not in VOTE_IMPACT_LEVELS:
            logger.warning(f"Invalid impact '{result['impact']}', defaulting to 'medium'")
            result["impact"] = "medium"

        # Enforce motion_title length constraint
        if len(result["motion_title"]) > MOTION_TITLE_MAX_LENGTH:
            original_length = len(result["motion_title"])
            result["motion_title"] = result["motion_title"][:MOTION_TITLE_MAX_LENGTH].rsplit(' ', 1)[0] + "..."
            logger.warning(f"Motion title truncated from {original_length} to {MOTION_TITLE_MAX_LENGTH} chars")

        # Log token usage
        if hasattr(response, 'usage') and response.usage:
            completion_tokens = response.usage.completion_tokens
            result["_ai_response_tokens"] = completion_tokens
        else:
            result["_ai_response_tokens"] = None

        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        logger.error(f"Failed to parse response: '{result_text[:500] if result_text else 'None'}'")
        raise
    except Exception as e:
        logger.error(f"AI processing error: {e}")
        if 'result_text' in locals():
            logger.error(f"Response was: '{result_text[:500] if result_text else 'None'}'")
        raise


async def process_vote_batch(votes_batch, semaphore, current_model, stats):
    """
    Process a batch of votes concurrently with semaphore rate limiting.

    Args:
        votes_batch: List of (index, vote) tuples to process
        semaphore: Asyncio semaphore for rate limiting
        current_model: Current AI model being used
        stats: Dictionary to track stats (errors, skipped, etc.)

    Returns:
        List of processed votes
    """
    async def process_single_vote(index, vote):
        vote_id = f"{vote.get('voter')}_{vote.get('meetingdate')}_{index}"

        async with semaphore:
            try:
                resolution = vote.get('resolution', '')
                if not resolution:
                    logger.warning(f"Skipping vote {index}: No resolution text")
                    stats["skipped"] += 1
                    return None

                # Process with AI
                try:
                    ai_result = await process_vote_with_ai_async(resolution, model=current_model)
                except (RateLimitError, APIError, APIConnectionError, APITimeoutError) as e:
                    # Track retry reasons
                    if "rate" in str(e).lower():
                        stats["retry_counts"]["rate_limit"] += 1
                    elif "timeout" in str(e).lower():
                        stats["retry_counts"]["timeout"] += 1
                    else:
                        stats["retry_counts"]["other"] += 1
                    raise  # Re-raise for retry decorator

                # Extract report numbers
                report_numbers = extract_report_numbers(resolution)

                # Add processed_at timestamp and model version
                processed_at = datetime.now().isoformat()

                # Combine data
                processed_vote = {
                    **vote,
                    **ai_result,
                    "ai_model_used": current_model,
                    "model_version": get_model_version(current_model),
                    "prompt_version": PROMPT_VERSION,
                    "processed_at": processed_at,
                    "ai_response_tokens": ai_result.get("_ai_response_tokens"),
                    "report_numbers": report_numbers
                }

                # Remove internal metadata
                if "_ai_response_tokens" in processed_vote:
                    del processed_vote["_ai_response_tokens"]

                logger.info(f"  ✓ [{index+1}] {ai_result['motion_title'][:60]}...")

                return (vote_id, processed_vote)

            except Exception as e:
                logger.error(f"Error processing vote {index}: {e}")
                stats["errors"] += 1
                return None

    # Process all votes in batch concurrently
    results = await asyncio.gather(
        *[process_single_vote(idx, vote) for idx, vote in votes_batch],
        return_exceptions=True
    )

    # Filter out None results and exceptions
    processed = []
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Exception in batch: {result}")
            stats["errors"] += 1
        elif result is not None:
            processed.append(result)

    return processed


async def process_all_votes_async(
    input_file: str | Path | None = None,
    output_file: str | Path | None = None,
    batch_size=ASYNC_BATCH_CHECKPOINT_SIZE,
    max_votes=None,
    resume=False,
    representative_sample=False,
    concurrency=CONCURRENT_REQUESTS
):
    """
    Async version: Process all raw votes with AI concurrently.

    Args:
        input_file: Path to raw votes JSON
        output_file: Path to save processed votes
        batch_size: Save progress every N votes
        max_votes: Limit processing to N votes (for testing)
        resume: Resume from checkpoint if available
        representative_sample: If True with max_votes, sample across meeting types
        concurrency: Number of concurrent requests
    """
    start_time = datetime.now()

    input_path = Path(input_file) if input_file else (DATA_DIR / "raw_votes.json")
    output_path = Path(output_file) if output_file else (DATA_DIR / "processed_votes.json")
    checkpoint = CheckpointManager(DATA_DIR / "checkpoint_ai_processing.json", interval=batch_size)

    logger.info(f"Loading raw votes from {input_path}")

    with open(input_path, 'r', encoding='utf-8') as f:
        raw_votes = json.load(f)

    # Check for checkpoint
    start_index = 0
    processed_votes = []
    processed_ids = set()

    if resume and checkpoint.exists():
        checkpoint_data = checkpoint.load()
        if checkpoint_data:
            start_index = checkpoint_data.get("last_processed_index", 0) + 1
            processed_ids = set(checkpoint_data.get("processed_vote_ids", []))
            # Load existing processed votes
            if output_path.exists():
                with open(output_path, 'r', encoding='utf-8') as f:
                    processed_votes = json.load(f)
            logger.info(f"Resuming from checkpoint at index {start_index}")

    if max_votes:
        if representative_sample:
            raw_votes = create_representative_sample(raw_votes, max_votes)
            logger.info(f"Test mode: Processing representative sample of {max_votes} votes")
        else:
            raw_votes = raw_votes[:max_votes]
            logger.info(f"Test mode: Processing first {max_votes} votes")
    else:
        logger.info(f"Processing {len(raw_votes)} votes with {concurrency} concurrent requests")

    # Create semaphore for rate limiting
    semaphore = asyncio.Semaphore(concurrency)

    # Stats tracking
    stats = {
        "errors": 0,
        "skipped": 0,
        "retry_counts": {"rate_limit": 0, "timeout": 0, "other": 0}
    }
    current_model = PRIMARY_MODEL

    # Process votes in batches
    votes_to_process = [
        (i, vote) for i, vote in enumerate(raw_votes[start_index:], start=start_index)
        if f"{vote.get('voter')}_{vote.get('meetingdate')}_{i}" not in processed_ids
    ]

    total_to_process = len(votes_to_process)
    logger.info(f"Processing {total_to_process} votes (skipping {len(raw_votes) - total_to_process} already processed)")

    # Process in batches for checkpointing
    for batch_start in range(0, len(votes_to_process), batch_size):
        batch_end = min(batch_start + batch_size, len(votes_to_process))
        batch = votes_to_process[batch_start:batch_end]

        logger.info(f"Processing batch {batch_start}-{batch_end} of {total_to_process}")

        # Process batch concurrently
        batch_results = await process_vote_batch(batch, semaphore, current_model, stats)

        # Add to processed votes
        for vote_id, processed_vote in batch_results:
            processed_votes.append(processed_vote)
            processed_ids.add(vote_id)

        # Save checkpoint
        last_index = batch[-1][0]  # Get index of last vote in batch
        checkpoint.save({
            "last_processed_index": last_index,
            "processed_vote_ids": list(processed_ids),
            "current_model": current_model,
            "stats": {
                "processed": len(processed_votes),
                "errors": stats["errors"],
                "skipped": stats["skipped"]
            }
        })

        # Save progress
        save_progress(processed_votes, output_path)
        logger.info(f"💾 Checkpoint saved ({len(processed_votes)} votes processed)")

    # Final save
    save_progress(processed_votes, output_path)
    checkpoint.clear()

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()

    # Print summary
    print_summary(
        start_time=start_time,
        duration=duration,
        total_votes=len(raw_votes),
        processed=len(processed_votes),
        skipped=stats["skipped"],
        errors=stats["errors"],
        model_used=current_model,
        retry_counts=stats["retry_counts"],
        output_file=output_path
    )

    logger.info("Async processing complete!")
    return processed_votes


def main():
    """Main entry point for async processor."""
    import sys

    logger.info("CivicCheckYYC - AI Processor (Async Concurrent)")
    logger.info("="*60)

    # Parse command line arguments
    test_mode = "--test" in sys.argv
    resume_mode = "--resume" in sys.argv
    sample_mode = "--sample" in sys.argv
    max_votes = 100 if test_mode else None  # Use 100 for testing async version

    if test_mode:
        if sample_mode:
            logger.warning(f"⚠ TEST MODE: Processing representative sample of 100 votes")
            logger.info("  Sample includes votes from multiple meeting types (Council, SPCs, committees)")
        else:
            logger.warning(f"⚠ TEST MODE: Processing first 100 votes")
            logger.info("  Add --sample flag for representative sample across meeting types")
        logger.info("  Run without --test flag to process all votes\n")

    if resume_mode:
        logger.info("📂 RESUME MODE: Will continue from checkpoint if available\n")

    logger.info(f"Concurrent requests: {CONCURRENT_REQUESTS}")
    logger.info(f"Model: {PRIMARY_MODEL}\n")

    # Run async processing
    try:
        processed = asyncio.run(
            process_all_votes_async(
                max_votes=max_votes,
                resume=resume_mode,
                representative_sample=sample_mode,
                concurrency=CONCURRENT_REQUESTS
            )
        )
        logger.info(f"\n✓ Done! Next step: Run upload_to_supabase.py")
    except KeyboardInterrupt:
        logger.warning("\n⚠ Processing interrupted by user")
        logger.info("  Run with --resume flag to continue from checkpoint")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n✗ Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
