"""
Shared utilities for CivicCheckYYC backend scripts.
Includes retry logic, checkpoint management, and helper functions.

Phase 1.5: Added meeting date parsing and URL construction utilities.
Phase 2: Added async utilities for concurrent processing.
"""

import time
import json
import functools
import logging
import re
import asyncio
from pathlib import Path
from typing import Callable, Any, Optional
from datetime import datetime
from urllib.parse import urlparse, parse_qs

from config import (
    MAX_RETRIES,
    RETRY_BASE_DELAY,
    MAX_RETRY_DELAY,
    ENABLE_CHECKPOINTS,
    ESCRIBA_BASE_URL
)

logger = logging.getLogger(__name__)


def retry_with_backoff(
    max_retries: int = MAX_RETRIES,
    base_delay: float = RETRY_BASE_DELAY,
    max_delay: float = MAX_RETRY_DELAY,
    exceptions: tuple = (Exception,)
):
    """
    Decorator that retries a function with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds (will be used as 2^n)
        max_delay: Maximum delay between retries (cap)
        exceptions: Tuple of exceptions to catch and retry on

    Usage:
        @retry_with_backoff(max_retries=3, exceptions=(requests.exceptions.RequestException,))
        def fetch_data():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_retries:
                        logger.error(
                            f"{func.__name__} failed after {max_retries} retries",
                            extra={"error": str(e), "function": func.__name__}
                        )
                        raise

                    # Calculate delay with exponential backoff
                    delay = min(base_delay * (2 ** attempt), max_delay)

                    logger.warning(
                        f"{func.__name__} attempt {attempt + 1}/{max_retries} failed, "
                        f"retrying in {delay:.1f}s",
                        extra={
                            "attempt": attempt + 1,
                            "max_retries": max_retries,
                            "delay": delay,
                            "error": str(e)
                        }
                    )

                    time.sleep(delay)

        return wrapper
    return decorator


def async_retry_with_backoff(
    max_retries: int = MAX_RETRIES,
    base_delay: float = RETRY_BASE_DELAY,
    max_delay: float = MAX_RETRY_DELAY,
    exceptions: tuple = (Exception,)
):
    """
    Async decorator that retries a coroutine with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds (will be used as 2^n)
        max_delay: Maximum delay between retries (cap)
        exceptions: Tuple of exceptions to catch and retry on

    Usage:
        @async_retry_with_backoff(max_retries=3, exceptions=(aiohttp.ClientError,))
        async def fetch_data():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_retries:
                        logger.error(
                            f"{func.__name__} failed after {max_retries} retries",
                            extra={"error": str(e), "function": func.__name__}
                        )
                        raise

                    # Calculate delay with exponential backoff
                    delay = min(base_delay * (2 ** attempt), max_delay)

                    logger.warning(
                        f"{func.__name__} attempt {attempt + 1}/{max_retries} failed, "
                        f"retrying in {delay:.1f}s",
                        extra={
                            "attempt": attempt + 1,
                            "max_retries": max_retries,
                            "delay": delay,
                            "error": str(e)
                        }
                    )

                    await asyncio.sleep(delay)

        return wrapper
    return decorator


class CheckpointManager:
    """
    Manages checkpoint files for resumable processing.

    Usage:
        checkpoint = CheckpointManager("data/checkpoint_ai.json")

        # Save checkpoint
        checkpoint.save({"last_index": 100, "processed_ids": [...]})

        # Load checkpoint
        data = checkpoint.load()

        # Check if should save (based on interval)
        if checkpoint.should_save(current_index):
            checkpoint.save({...})
    """

    def __init__(self, checkpoint_path: Path | str, interval: int = 50):
        """
        Args:
            checkpoint_path: Path to checkpoint file
            interval: Save checkpoint every N operations
        """
        self.checkpoint_path = Path(checkpoint_path)
        self.interval = interval
        self.last_save_index = 0
        self.enabled = ENABLE_CHECKPOINTS

    def save(self, data: dict) -> None:
        """Save checkpoint data to file (atomic write)."""
        if not self.enabled:
            return

        # Add metadata
        data["_checkpoint_timestamp"] = datetime.now().isoformat()
        data["_checkpoint_version"] = "1.0"

        # Atomic write: write to temp file, then rename
        temp_path = self.checkpoint_path.with_suffix(".tmp")
        self.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)

            # Atomic rename
            temp_path.rename(self.checkpoint_path)
            logger.info(f"Checkpoint saved to {self.checkpoint_path}")

        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")
            if temp_path.exists():
                temp_path.unlink()

    def load(self) -> Optional[dict]:
        """Load checkpoint data from file."""
        if not self.enabled or not self.checkpoint_path.exists():
            return None

        try:
            with open(self.checkpoint_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Validate checkpoint structure
            if "_checkpoint_version" not in data:
                logger.warning("Checkpoint file has invalid structure")
                return None

            logger.info(
                f"Loaded checkpoint from {data.get('_checkpoint_timestamp', 'unknown time')}"
            )
            return data

        except Exception as e:
            logger.error(f"Failed to load checkpoint: {e}")
            return None

    def should_save(self, current_index: int) -> bool:
        """Check if checkpoint should be saved based on interval."""
        if not self.enabled:
            return False

        if current_index - self.last_save_index >= self.interval:
            self.last_save_index = current_index
            return True
        return False

    def clear(self) -> None:
        """Delete checkpoint file."""
        if self.checkpoint_path.exists():
            self.checkpoint_path.unlink()
            logger.info(f"Checkpoint cleared: {self.checkpoint_path}")

    def exists(self) -> bool:
        """Check if checkpoint file exists."""
        return self.checkpoint_path.exists()


def setup_logging(log_file: Path | str, level: str = "INFO") -> logging.Logger:
    """
    Configure logging for a script.

    Args:
        log_file: Path to log file
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    Returns:
        Configured logger instance
    """
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    # Get the script's logger (based on calling module)
    script_logger = logging.getLogger()
    script_logger.setLevel(getattr(logging, level.upper()))

    # Remove existing handlers
    script_logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, level.upper()))
    console_formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)

    # File handler (more verbose)
    file_handler = logging.FileHandler(log_path, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s:%(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)

    script_logger.addHandler(console_handler)
    script_logger.addHandler(file_handler)

    return script_logger


def format_duration(seconds: float) -> str:
    """
    Format duration in seconds to human-readable string.

    Args:
        seconds: Duration in seconds

    Returns:
        Formatted string (e.g., "2h 30m 15s")
    """
    hours, remainder = divmod(int(seconds), 3600)
    minutes, seconds = divmod(remainder, 60)

    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")

    return " ".join(parts)


def print_summary_box(title: str, stats: dict, width: int = 60) -> None:
    """
    Print a formatted summary box.

    Args:
        title: Summary title
        stats: Dictionary of stats to display
        width: Box width in characters
    """
    separator = "=" * width
    print(f"\n{separator}")
    print(f"{title.center(width)}")
    print(separator)

    for key, value in stats.items():
        # Handle nested dicts (for grouping)
        if isinstance(value, dict):
            print(f"\n{key}:")
            for sub_key, sub_value in value.items():
                print(f"  {sub_key}: {sub_value}")
        else:
            print(f"{key}: {value}")

    print(separator)


# ============================================================================
# Phase 1.5: Meeting Date Parsing and URL Construction
# ============================================================================

def parse_calgary_meeting_date(date_str: str) -> Optional[str]:
    """
    Parse Calgary calendar meeting date to ISO format (YYYY-MM-DD).

    The Calgary calendar dataset uses human-readable dates like:
    - "Wednesday, October 29, 2025, 6 p.m."
    - "Monday, November 3, 2025, 9:30 a.m."
    - "Monday, October 13, 2025 Holiday"
    - "Tuesday, November 11 - Friday, November 14, 2025" (date ranges)

    Args:
        date_str: Human-readable date string from Calgary calendar

    Returns:
        ISO date string (YYYY-MM-DD) or None if parsing fails

    Examples:
        "Wednesday, October 29, 2025, 6 p.m." → "2025-10-29"
        "Monday, November 3, 2025, 9:30 a.m." → "2025-11-03"
        "Monday, October 13, 2025 Holiday" → "2025-10-13"
    """
    if not date_str:
        return None

    try:
        # Remove time components and extra text
        # Pattern: "DayOfWeek, Month Day, Year[, time] [extra text]"
        # Extract: "Month Day, Year"

        # Remove time (e.g., "9:30 a.m.", "6 p.m.")
        date_str_clean = re.sub(r',?\s*\d{1,2}(:\d{2})?\s*(a\.m\.|p\.m\.)', '', date_str)

        # Remove trailing text (e.g., "Holiday", "Election")
        date_str_clean = re.sub(r'\s+(Holiday|Election|Recess).*$', '', date_str_clean)

        # Handle date ranges - take first date only
        if ' - ' in date_str_clean:
            date_str_clean = date_str_clean.split(' - ')[0]

        # Extract date components using regex
        # Pattern: "DayOfWeek, Month Day, Year"
        match = re.search(r'([A-Za-z]+),\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', date_str_clean)

        if match:
            day_of_week, month_name, day, year = match.groups()

            # Construct parseable date string
            date_to_parse = f"{month_name} {day}, {year}"

            # Parse to datetime and convert to ISO format
            parsed_date = datetime.strptime(date_to_parse, "%B %d, %Y")
            return parsed_date.date().isoformat()

        # Fallback: Try to parse directly
        parsed_date = datetime.strptime(date_str_clean.strip(), "%B %d, %Y")
        return parsed_date.date().isoformat()

    except Exception as e:
        logger.warning(f"Failed to parse meeting date '{date_str}': {e}")
        return None


def extract_trumba_event_id(calendar_url: str) -> Optional[str]:
    """
    Extract Trumba event ID from Calgary calendar URL.

    Calgary calendar URLs follow the pattern:
    https://www.calgary.ca/council/meetings/council-calendars.html?trumbaEmbed=view%3devent%26eventid%3d178933427

    Args:
        calendar_url: Full calendar event URL

    Returns:
        Event ID string (e.g., "178933427") or None if extraction fails

    Examples:
        "...?trumbaEmbed=view%3devent%26eventid%3d178933427" → "178933427"
    """
    if not calendar_url:
        return None

    try:
        # Parse URL and extract query parameters
        parsed_url = urlparse(calendar_url)
        query_params = parse_qs(parsed_url.query)

        # Get trumbaEmbed parameter
        trumba_embed = query_params.get('trumbaEmbed', [None])[0]

        if trumba_embed:
            # Extract eventid using regex
            match = re.search(r'eventid[=%](\d+)', trumba_embed)
            if match:
                return match.group(1)

        return None

    except Exception as e:
        logger.warning(f"Failed to extract Trumba event ID from '{calendar_url}': {e}")
        return None


def construct_escriba_meeting_url(meeting_id: str, language: str = "English") -> str:
    """
    Construct eScribe meeting page URL from meeting ID.

    Args:
        meeting_id: eScribe meeting GUID
        language: Meeting language ("English" or "French")

    Returns:
        Full eScribe meeting URL

    Examples:
        construct_escriba_meeting_url("c178e743-5a67-4e79-aab2-b375479f1ae5")
        → "https://pub-calgary.escribemeetings.com/Meeting.aspx?Id=c178e743-5a67-4e79-aab2-b375479f1ae5&lang=English"
    """
    return f"{ESCRIBA_BASE_URL}/Meeting.aspx?Id={meeting_id}&lang={language}"


def normalize_vote_date(date_str: str) -> Optional[str]:
    """
    Normalize vote date from votes dataset to ISO format.

    The votes dataset uses ISO format with time:
    "2024-09-05T00:00:00.000"

    Args:
        date_str: Date string from votes dataset

    Returns:
        ISO date string (YYYY-MM-DD) or None if parsing fails

    Examples:
        "2024-09-05T00:00:00.000" → "2024-09-05"
    """
    if not date_str:
        return None

    try:
        # Remove time component and parse
        date_only = date_str.split('T')[0]

        # Validate format
        parsed_date = datetime.strptime(date_only, "%Y-%m-%d")
        return parsed_date.date().isoformat()

    except Exception as e:
        logger.warning(f"Failed to normalize vote date '{date_str}': {e}")
        return None
