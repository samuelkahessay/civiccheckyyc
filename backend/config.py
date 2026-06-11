"""
Centralized configuration for CivicCheckYYC backend scripts.

Phase 1: Added provenance tracking configuration
- Prompt versioning
- Model version tracking
- Source dataset identifiers
"""

from pathlib import Path
from datetime import datetime

# Project Structure
BACKEND_DIR = Path(__file__).resolve().parent
PROMPTS_DIR = BACKEND_DIR / "prompts"

# ============================================================================
# Phase 1: Provenance Tracking Configuration
# ============================================================================

# Prompt Versioning
PROMPT_VERSION = "v1.0-2025-10-08"  # Update when prompt changes
PROMPT_FILE = PROMPTS_DIR / "vote_processing_v1.0.txt"

# Model Versioning (for Phase 1 - update as models evolve)
# Format: model-name@deployment-date
def get_model_version(model_name: str) -> str:
    """Generate model version string for provenance tracking."""
    return f"{model_name}@2025-10-01"  # October 2025 deployment

# Socrata Dataset Configuration
SOURCE_DATASET_ID = "ruq3-99hx"  # Calgary Council and Committee Votes
SOCRATA_BASE_URL = "https://data.calgary.ca"

# Source URL Construction
def construct_source_api_url(row_id: str) -> str:
    """Construct direct API URL for a specific vote record."""
    return f"{SOCRATA_BASE_URL}/resource/{SOURCE_DATASET_ID}/{row_id}.json"

# ============================================================================
# Retry Configuration
# ============================================================================

MAX_RETRIES = 3
RETRY_BASE_DELAY = 2  # seconds - will be used as base for exponential backoff (2^n)
MAX_RETRY_DELAY = 60  # seconds - cap on exponential backoff

# Rate Limiting
RATE_LIMIT_DELAY = 0.2  # seconds between API requests

# Checkpoint Configuration
CHECKPOINT_INTERVAL = 50  # Save checkpoint after every N votes processed
ENABLE_CHECKPOINTS = True  # Set to False to disable checkpoint mechanism

# Logging Configuration
LOG_LEVEL = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# AI Processing Configuration
AI_MAX_TOKENS = 1500  # Max tokens for GPT response (increased for temperature=1.0 variability)
AI_TEMPERATURE = 1.0  # GPT-5 models only support temperature=1 (default)
AI_TIMEOUT = 30  # seconds - timeout for AI API calls

# Phase 1: AI Output Constraints
MOTION_TITLE_MAX_LENGTH = 120  # characters (enforced post-generation, with truncation warning)
# Note: motion_summary is flexible - prompt suggests 1-2 sentences but prioritizes clarity

# Batch Processing
BATCH_SIZE = 50  # Process and save in batches of N votes
TEST_MODE_LIMIT = 20  # Number of votes to process in test mode

# Async Processing Configuration
CONCURRENT_REQUESTS = 15  # Number of concurrent API requests (async mode)
MAX_TOKENS_PER_MINUTE = 150000  # OpenAI rate limit (adjust based on tier)
ASYNC_BATCH_CHECKPOINT_SIZE = 100  # Save checkpoint every N votes in async mode

# Topic Categories (for validation)
VALID_TOPICS = [
    # Substantive Policy Topics
    "Housing",
    "Transit",
    "Budget",
    "PublicSafety",
    "Environment",
    "EconomicDevelopment",
    "Infrastructure",
    "SocialServices",
    "Planning",

    # Governance Subcategories (more granular)
    "IndigenousRelations",       # Reconciliation, protocol agreements, land acknowledgment
    "IntergovernmentalAffairs",  # Provincial/federal relations, regional partnerships
    "Governance",                # Council ethics, election policy, transparency, board appointments
    "Procedural",                # Routine admin: receive reports, confirm agendas, closed meetings

    "Other"
]

# Vote Impact Levels (for prioritization)
VOTE_IMPACT_LEVELS = ["high", "medium", "low"]

# Councillor Mapping (for upload_to_supabase.py)
# Maps variations of councillor names to candidate slugs
COUNCILLOR_TO_CANDIDATE = {
    "Jyoti Gondek": "jyoti-gondek",
    "Mayor J. Gondek": "jyoti-gondek",
    "Jeromy Farkas": "jeromy-farkas",
    "Jeff Davison": "jeff-davison",
    "Sonya Sharp": "sonya-sharp"
}

# ============================================================================
# Phase 1.5: Meeting Indexer Configuration
# ============================================================================

# Calgary Council Calendar Dataset
MEETINGS_DATASET_ID = "23m4-i42g"  # Calgary Council Calendar
MEETINGS_CACHE_FILE = "meetings_index.json"  # Cached meeting metadata

# eScribe Meeting System
ESCRIBA_BASE_URL = "https://pub-calgary.escribemeetings.com"
ESCRIBA_SEARCH_ENDPOINT = f"{ESCRIBA_BASE_URL}/GetSearchData.asmx/GetSearchMeetingData"

# Meeting Type Normalization
# Maps meeting types from votes dataset to calendar dataset and vice versa
# This enables matching votes to meetings despite naming inconsistencies
MEETING_TYPE_NORMALIZATION = {
    # Votes dataset → Normalized type
    "Regular Meeting of Council": "Regular Meeting of Council",
    "Combined Meeting of Council": "Combined Meeting of Council",
    "Public Hearing": "Public Hearing",
    "Organizational Meeting of Council": "Organizational Meeting of Council",
    "Strategic Meeting of Council": "Strategic Meeting of Council",
    "Intergovernmental Affairs Committee": "Intergovernmental Affairs Committee",
    "Calgary Planning Commission": "Calgary Planning Commission",
    "Audit Committee": "Audit Committee",
    "Community Development Committee": "Community Development Committee",
    "Infrastructure and Planning Committee": "Infrastructure and Planning Committee",
    "Executive Committee": "Executive Committee",
    "Priorities and Finance Committee": "Priorities and Finance Committee",
    "Council Services Committee": "Council Services Committee",
    "Nominations Committee": "Nominations Committee",

    # Calendar dataset → Normalized type (reverse mapping)
    "Council meeting - Regular": "Regular Meeting of Council",
    "Council meeting - Combined": "Combined Meeting of Council",
    "Council meeting - Public hearing": "Public Hearing",
    "Council meeting - Organizational": "Organizational Meeting of Council",
    "Council meeting - Organizational - Part 1": "Organizational Meeting of Council",
    "Council meeting - Organizational - Part 2": "Organizational Meeting of Council",
    "Council meeting - Strategic": "Strategic Meeting of Council",

    # Committee variations (calendar dataset often drops "Committee")
    "Intergovernmental Affairs": "Intergovernmental Affairs Committee",
    "Calgary Planning": "Calgary Planning Commission",
    "Audit": "Audit Committee",
    "Community Development": "Community Development Committee",
    "Infrastructure and Planning": "Infrastructure and Planning Committee",
    "Executive": "Executive Committee",
    "Priorities and Finance": "Priorities and Finance Committee",
    "Council Services": "Council Services Committee",
    "Nominations": "Nominations Committee",
}

def normalize_meeting_type(meeting_type: str) -> str:
    """
    Normalize meeting type to standard format for matching.

    Args:
        meeting_type: Meeting type from either votes or calendar dataset

    Returns:
        Normalized meeting type string

    Examples:
        "Council meeting - Regular" → "Regular Meeting of Council"
        "Intergovernmental Affairs" → "Intergovernmental Affairs Committee"
        "Regular Meeting of Council" → "Regular Meeting of Council" (already normalized)
    """
    if not meeting_type:
        return "Unknown Meeting"

    # Direct match
    if meeting_type in MEETING_TYPE_NORMALIZATION:
        return MEETING_TYPE_NORMALIZATION[meeting_type]

    # Partial match (case-insensitive)
    meeting_type_lower = meeting_type.lower().strip()
    for source_type, normalized in MEETING_TYPE_NORMALIZATION.items():
        if source_type.lower() in meeting_type_lower or meeting_type_lower in source_type.lower():
            return normalized

    # No match - return original
    return meeting_type

# Calgary Timezone
# Calgary uses Mountain Time (MT): MST (UTC-7) and MDT (UTC-6)
# This is important for date parsing from calendar dataset
CALGARY_TIMEZONE = "America/Edmonton"  # Calgary follows Alberta timezone rules

# Meeting Indexer Settings
MEETING_FETCH_YEARS_BACK = 5  # Fetch meetings from last N years
MEETING_INDEX_BATCH_SIZE = 100  # Process meetings in batches
ENABLE_ESCRIBA_SCRAPING = False  # Enable/disable eScribe scraping (slow, optional)
