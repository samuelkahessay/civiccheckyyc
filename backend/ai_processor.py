"""
Process raw voting records with GPT-5-mini to create:
- Concise motion titles
- Plain-language summaries
- Topic classifications

Enhanced with:
- Retry logic with exponential backoff
- Resume/checkpoint mechanism
- Structured logging
- Summary reports
- Report number extraction for attribution

Uses OpenAI GPT-5-mini (falls back to a smaller gpt-5 model only – never to gpt-4 family)
"""

import os
import json
import logging
import re
from pathlib import Path
from openai import OpenAI, RateLimitError, APIError, APIConnectionError, APITimeoutError
from dotenv import load_dotenv
import time
from datetime import datetime

# Import shared utilities and config
from config import *
from utils import retry_with_backoff, CheckpointManager, setup_logging, format_duration, print_summary_box

# Resolve repo root and data directory regardless of CWD
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"

load_dotenv()

# Initialize logging
logger = setup_logging(DATA_DIR / "processing.log", LOG_LEVEL)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_KEY"))

# Enforce gpt-5-only models and smallest-first fallback
def _validate_model_or_raise(name: str, label: str) -> str:
    if not name:
        raise ValueError(f"{label} is required")
    if not name.startswith("gpt-5"):
        # Hard block any gpt-4* or other families from being used here
        raise ValueError(f"{label} must be a gpt-5 family model, got: {name}")
    return name

# Model selection (prefer env override for stability)
PRIMARY_MODEL = _validate_model_or_raise(os.getenv("OPENAI_MODEL", "gpt-5-mini"), "OPENAI_MODEL")
# Fallback must be a smaller gpt-5 model (never gpt-4 family)
FALLBACK_MODEL = _validate_model_or_raise(os.getenv("OPENAI_FALLBACK_MODEL", "gpt-5-nano"), "OPENAI_FALLBACK_MODEL")

# Phase 1: Load prompt from versioned file
def load_prompt_template():
    """Load the versioned prompt template from file."""
    try:
        with open(PROMPT_FILE, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract the prompt content (skip header section)
        if "================================================================================\nVOTE PROCESSING PROMPT" in content:
            prompt_start = content.find("You are analyzing a Calgary City Council voting record.")
            if prompt_start > 0:
                return content[prompt_start:]

        # Fallback: return full content
        return content
    except FileNotFoundError:
        logger.error(f"Prompt file not found: {PROMPT_FILE}")
        logger.warning("Using inline fallback prompt")
        return FALLBACK_PROMPT

# Fallback inline prompt (in case file is missing)
FALLBACK_PROMPT = """You are analyzing a Calgary City Council voting record.

Your task: Given the resolution text below, create a concise title, plain-language summary, classify it into a topic, and assess its impact.

Resolution text:
---
{resolution}
---

Return ONLY a JSON object with this exact structure (no additional text):
{{
  "motion_title": "Brief title (max 100 chars)",
  "motion_summary": "One-sentence plain-language explanation of what this does",
  "topic": "One of: Housing, Transit, Budget, PublicSafety, Environment, EconomicDevelopment, Infrastructure, SocialServices, Planning, IndigenousRelations, IntergovernmentalAffairs, Governance, Procedural, Other",
  "impact": "high, medium, or low"
}}

CRITICAL RULES:
1. motion_title: Clear, concise, no jargon. Start with a verb (e.g., "Approve budget for...", "Reject rezoning...")
2. motion_summary: Explain the practical impact in plain language a citizen would understand
3. topic: Pick the MOST relevant category:
   - Housing, Transit, Budget, PublicSafety, Environment, EconomicDevelopment, Infrastructure, SocialServices, Planning: Substantive policy areas
   - IndigenousRelations: Reconciliation, protocol agreements, Indigenous partnerships
   - IntergovernmentalAffairs: Provincial/federal relations, regional cooperation, joint initiatives
   - Governance: Council ethics, election policy, transparency, board appointments, city governance structure
   - Procedural: Routine admin like "receive report for corporate record", agenda confirmations, closed meeting motions
   - Other: If none fit
4. impact:
   - "high": Policy changes, major budget allocations, significant decisions affecting citizens
   - "medium": Important but routine approvals, moderate budget items, standard planning decisions
   - "low": Procedural/administrative (receive reports, agenda items, routine updates)
5. Return ONLY valid JSON, no markdown formatting or extra text"""

# Load the versioned prompt on startup
PROCESSING_PROMPT = load_prompt_template()
logger.info(f"Loaded prompt version: {PROMPT_VERSION}")



@retry_with_backoff(
    max_retries=MAX_RETRIES,
    base_delay=RETRY_BASE_DELAY,
    max_delay=MAX_RETRY_DELAY,
    exceptions=(RateLimitError, APIError, APIConnectionError, APITimeoutError)
)
def process_vote_with_ai(resolution_text, model=PRIMARY_MODEL):
    """
    Use GPT-5-mini to process a single resolution (with retry logic).

    Args:
        resolution_text: The raw resolution text from the vote
        model: OpenAI model to use

    Returns:
        dict with motion_title, motion_summary, topic
    """
    prompt = PROCESSING_PROMPT.format(resolution=resolution_text[:3000])

    try:
        # Phase 1: Enforce JSON output and track token usage
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that processes government documents into plain language. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},  # Phase 1: Force JSON output
            temperature=AI_TEMPERATURE,
            max_completion_tokens=AI_MAX_TOKENS,
            timeout=AI_TIMEOUT
        )

        # Debug: inspect response structure
        choice = response.choices[0]
        logger.debug(f"Response finish_reason: {choice.finish_reason}")
        logger.debug(f"Response message: {choice.message}")

        # Check for refusal (GPT-5 safety feature)
        if hasattr(choice.message, 'refusal') and choice.message.refusal:
            logger.error(f"AI refused to respond: {choice.message.refusal}")
            raise ValueError(f"AI refusal: {choice.message.refusal}")

        result_text = choice.message.content

        # Log raw response for debugging
        logger.debug(f"Raw AI response: {result_text[:300] if result_text else 'None'}")

        if not result_text:
            logger.error(f"AI returned empty response. Finish reason: {choice.finish_reason}")
            raise ValueError(f"Empty response from AI (finish_reason: {choice.finish_reason})")

        result_text = result_text.strip()

        # Remove markdown code blocks if present
        if result_text.startswith("```json"):
            result_text = result_text.replace("```json", "").replace("```", "").strip()
        elif result_text.startswith("```"):
            result_text = result_text.replace("```", "").strip()

        # Log cleaned text before parsing
        logger.debug(f"Cleaned text for JSON parsing: {result_text[:200]}")

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
        from config import VOTE_IMPACT_LEVELS
        if result["impact"] not in VOTE_IMPACT_LEVELS:
            logger.warning(f"Invalid impact '{result['impact']}', defaulting to 'medium'")
            result["impact"] = "medium"

        # Phase 1: Enforce motion_title length constraint
        if len(result["motion_title"]) > MOTION_TITLE_MAX_LENGTH:
            original_length = len(result["motion_title"])
            result["motion_title"] = result["motion_title"][:MOTION_TITLE_MAX_LENGTH].rsplit(' ', 1)[0] + "..."
            logger.warning(f"Motion title truncated from {original_length} to {MOTION_TITLE_MAX_LENGTH} chars")

        # Phase 1: Log token usage for cost tracking
        if hasattr(response, 'usage') and response.usage:
            completion_tokens = response.usage.completion_tokens
            result["_ai_response_tokens"] = completion_tokens
            logger.info(f"AI tokens used: {completion_tokens}")
        else:
            result["_ai_response_tokens"] = None

        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        logger.error(f"Failed to parse response: '{result_text[:500] if result_text else 'None'}'")
        logger.error(f"Resolution text (first 200 chars): {resolution_text[:200]}")
        raise
    except Exception as e:
        logger.error(f"AI processing error: {e}")
        if 'result_text' in locals():
            logger.error(f"Response was: '{result_text[:500] if result_text else 'None'}'")
        raise


def extract_report_numbers(resolution_text):
    """
    Extract Calgary report numbers from resolution text.

    Common patterns:
    - C2024-1042 (Council reports)
    - IGA2024-0941 (Intergovernmental Affairs)
    - PFC2021-1198 (Priorities and Finance Committee)
    - AC2022-0405 (Audit Committee)
    - CPC2022-0956 (Calgary Planning Commission)
    - TT2021-0583 (Transportation and Transit)
    - PUD2021-0969 (Planning and Urban Development)

    Args:
        resolution_text: The resolution text to extract from

    Returns:
        List of unique report numbers (e.g., ["C2024-1042", "IGA2024-0941"])
    """
    if not resolution_text:
        return []

    # Pattern: 1-4 uppercase letters, 4 digits, dash, 4 digits
    # Examples: C2024-1042, IGA2024-0941, PFC2021-1198
    pattern = r'\b[A-Z]{1,4}\d{4}-\d{4}\b'

    matches = re.findall(pattern, resolution_text)

    # Return unique report numbers (preserve order)
    seen = set()
    unique_reports = []
    for report in matches:
        if report not in seen:
            seen.add(report)
            unique_reports.append(report)

    return unique_reports


def create_representative_sample(votes, sample_size=20):
    """
    Create a representative sample of votes across different meeting types.

    Args:
        votes: Full list of votes
        sample_size: Number of votes to sample

    Returns:
        List of sampled votes
    """
    import random

    # Group votes by meeting type
    by_meeting_type = {}
    for vote in votes:
        meeting_type = vote.get('meetingtype', 'Unknown')
        if meeting_type not in by_meeting_type:
            by_meeting_type[meeting_type] = []
        by_meeting_type[meeting_type].append(vote)

    # Target distribution (prioritize substantive meetings)
    priority_types = [
        "Combined Meeting of Council",
        "Regular Meeting of Council",
        "SPC on Transportation and Transit",
        "SPC on Planning and Urban Development",
        "Calgary Planning Commission"
    ]

    sample = []
    remaining = sample_size

    # Sample 70% from priority meetings
    priority_count = int(sample_size * 0.7)
    for meeting_type in priority_types:
        if meeting_type in by_meeting_type and remaining > 0:
            available = by_meeting_type[meeting_type]
            take = min(len(available), max(1, priority_count // len(priority_types)))
            sample.extend(random.sample(available, min(take, len(available))))
            remaining -= take

    # Sample 30% from other meeting types
    other_types = [mt for mt in by_meeting_type if mt not in priority_types]
    if other_types and remaining > 0:
        for meeting_type in other_types:
            if remaining <= 0:
                break
            available = by_meeting_type[meeting_type]
            take = min(len(available), max(1, remaining // len(other_types)))
            sample.extend(random.sample(available, min(take, len(available))))
            remaining -= take

    # If we still need more, fill from largest groups
    if remaining > 0:
        all_remaining = [v for v in votes if v not in sample]
        if all_remaining:
            sample.extend(random.sample(all_remaining, min(remaining, len(all_remaining))))

    logger.info(f"Created representative sample of {len(sample)} votes")
    logger.info(f"Sample meeting types: {set(v.get('meetingtype') for v in sample)}")

    return sample[:sample_size]


def process_all_votes(
    input_file: str | Path | None = None,
    output_file: str | Path | None = None,
    batch_size=BATCH_SIZE,
    max_votes=None,
    resume=False,
    representative_sample=False
):
    """
    Process all raw votes with AI (with checkpoint/resume support).

    Args:
        input_file: Path to raw votes JSON
        output_file: Path to save processed votes
        batch_size: Save progress every N votes
        max_votes: Limit processing to N votes (for testing)
        resume: Resume from checkpoint if available
        representative_sample: If True with max_votes, sample across meeting types instead of first N
    """
    start_time = datetime.now()

    input_path = Path(input_file) if input_file else (DATA_DIR / "raw_votes.json")
    output_path = Path(output_file) if output_file else (DATA_DIR / "processed_votes.json")
    checkpoint = CheckpointManager(DATA_DIR / "checkpoint_ai_processing.json", interval=batch_size)

    logger.info(f"Loading raw votes from {input_path}")

    with open(input_path, 'r', encoding='utf-8') as f:
        raw_votes = json.load(f)

    # Check for checkpoint
    checkpoint_data = None
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
        logger.info(f"Processing {len(raw_votes)} votes")

    # Process votes
    errors = 0
    skipped = 0
    current_model = PRIMARY_MODEL
    retry_counts = {"rate_limit": 0, "timeout": 0, "other": 0}

    for i, vote in enumerate(raw_votes[start_index:], start=start_index):
        vote_id = f"{vote.get('voter')}_{vote.get('meetingdate')}_{i}"

        # Skip if already processed
        if vote_id in processed_ids:
            logger.debug(f"Skipping already processed vote {vote_id}")
            skipped += 1
            continue

        logger.info(f"[{i+1}/{len(raw_votes)}] Processing vote for {vote.get('voter')}")

        resolution = vote.get('resolution', '')
        if not resolution:
            logger.warning(f"Skipping vote {i}: No resolution text")
            skipped += 1
            continue

        # Process with AI (with retry logic)
        try:
            ai_result = process_vote_with_ai(resolution, model=current_model)
        except (RateLimitError, APIError, APIConnectionError, APITimeoutError) as e:
            # Track retry reasons
            if "rate" in str(e).lower():
                retry_counts["rate_limit"] += 1
            elif "timeout" in str(e).lower():
                retry_counts["timeout"] += 1
            else:
                retry_counts["other"] += 1

            # Try fallback model
            if current_model == PRIMARY_MODEL:
                logger.warning(f"Switching to smaller gpt-5 fallback model {FALLBACK_MODEL}")
                try:
                    ai_result = process_vote_with_ai(resolution, model=FALLBACK_MODEL)
                    current_model = FALLBACK_MODEL
                except Exception:
                    logger.error(f"Failed to process vote {i} even with fallback model")
                    errors += 1
                    continue
            else:
                errors += 1
                continue
        except Exception as e:
            logger.error(f"Unexpected error processing vote {i}: {e}")
            errors += 1
            continue

        # Extract report numbers for attribution
        report_numbers = extract_report_numbers(resolution)

        # Phase 1: Add processed_at timestamp and model version
        processed_at = datetime.now().isoformat()

        # Combine original vote data with AI-processed data and extracted metadata
        processed_vote = {
            **vote,
            **ai_result,
            "ai_model_used": current_model,
            "model_version": get_model_version(current_model),  # Phase 1: Model provenance
            "prompt_version": PROMPT_VERSION,  # Phase 1: Prompt provenance
            "processed_at": processed_at,  # Phase 1: Processing timestamp
            "ai_response_tokens": ai_result.get("_ai_response_tokens"),  # Phase 1: Token tracking
            "report_numbers": report_numbers
        }

        # Remove internal metadata fields
        if "_ai_response_tokens" in processed_vote:
            del processed_vote["_ai_response_tokens"]

        processed_votes.append(processed_vote)
        processed_ids.add(vote_id)

        logger.info(f"  ✓ Title: {ai_result['motion_title'][:60]}...")
        logger.debug(f"  Topic: {ai_result['topic']}")

        # Save checkpoint
        if checkpoint.should_save(i):
            checkpoint.save({
                "last_processed_index": i,
                "processed_vote_ids": list(processed_ids),
                "current_model": current_model,
                "stats": {
                    "processed": len(processed_votes),
                    "errors": errors,
                    "skipped": skipped
                }
            })
            # Save progress to output file
            save_progress(processed_votes, output_path)
            logger.info(f"💾 Checkpoint saved ({len(processed_votes)} votes processed)")

        # Rate limiting
        time.sleep(RATE_LIMIT_DELAY)

    # Final save
    save_progress(processed_votes, output_path)
    checkpoint.clear()  # Clear checkpoint after successful completion

    # Calculate duration
    duration = (datetime.now() - start_time).total_seconds()

    # Print summary
    print_summary(
        start_time=start_time,
        duration=duration,
        total_votes=len(raw_votes),
        processed=len(processed_votes),
        skipped=skipped,
        errors=errors,
        model_used=current_model,
        retry_counts=retry_counts,
        output_file=output_path
    )

    logger.info("Processing complete!")
    return processed_votes


def save_progress(votes, output_file: str | Path):
    """Save processed votes to file."""
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(votes, f, indent=2, ensure_ascii=False)


def print_summary(start_time, duration, total_votes, processed, skipped, errors, model_used, retry_counts, output_file):
    """Print processing summary."""
    # Group votes by topic and impact
    topics = {}
    impacts = {}
    with open(output_file, 'r', encoding='utf-8') as f:
        votes = json.load(f)
        for vote in votes:
            topic = vote.get('topic', 'Other')
            topics[topic] = topics.get(topic, 0) + 1

            impact = vote.get('impact', 'unknown')
            impacts[impact] = impacts.get(impact, 0) + 1

    stats = {
        "Started": start_time.strftime("%Y-%m-%d %H:%M:%S"),
        "Completed": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Duration": format_duration(duration),
        "": "",  # Empty line
        "Total votes": f"{total_votes:,}",
        "Processed": f"{processed:,} ({processed/total_votes*100:.1f}%)",
        "Skipped": f"{skipped:,} ({skipped/total_votes*100:.1f}%)",
        "Errors": f"{errors:,} ({errors/total_votes*100:.1f}%)",
        " ": "",  # Empty line
        "Model used": model_used,
        "Total retries": f"{sum(retry_counts.values())}",
        "Retry breakdown": {
            "Rate limits": retry_counts["rate_limit"],
            "Timeouts": retry_counts["timeout"],
            "Other": retry_counts["other"]
        },
        "  ": "",  # Empty line
        "Vote Impact Distribution": {impact: f"{count:,} ({count/processed*100:.1f}%)" for impact, count in sorted(impacts.items(), key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x[0], 3))},
        "   ": "",  # Empty line
        "Topics": {topic: count for topic, count in sorted(topics.items(), key=lambda x: x[1], reverse=True)},
        "    ": "",  # Empty line
        "Output file": str(output_file),
        "Log file": str(DATA_DIR / "processing.log")
    }

    print_summary_box("PROCESSING SUMMARY", stats)


if __name__ == "__main__":
    import sys

    logger.info("CivicCheckYYC - AI Processor (GPT-5-mini)")
    logger.info("="*60)

    # Parse command line arguments
    test_mode = "--test" in sys.argv
    resume_mode = "--resume" in sys.argv
    sample_mode = "--sample" in sys.argv
    max_votes = TEST_MODE_LIMIT if test_mode else None

    if test_mode:
        if sample_mode:
            logger.warning(f"⚠ TEST MODE: Processing representative sample of {TEST_MODE_LIMIT} votes")
            logger.info("  Sample includes votes from multiple meeting types (Council, SPCs, committees)")
        else:
            logger.warning(f"⚠ TEST MODE: Processing first {TEST_MODE_LIMIT} votes")
            logger.info("  Add --sample flag for representative sample across meeting types")
        logger.info("  Run without --test flag to process all votes\n")

    if resume_mode:
        logger.info("📂 RESUME MODE: Will continue from checkpoint if available\n")

    # Process votes
    try:
        processed = process_all_votes(
            max_votes=max_votes,
            resume=resume_mode,
            representative_sample=sample_mode
        )
        logger.info(f"\n✓ Done! Next step: Run upload_to_supabase.py")
    except KeyboardInterrupt:
        logger.warning("\n⚠ Processing interrupted by user")
        logger.info("  Run with --resume flag to continue from checkpoint")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n✗ Fatal error: {e}", exc_info=True)
        sys.exit(1)
