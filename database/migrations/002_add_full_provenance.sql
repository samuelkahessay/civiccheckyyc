-- Migration 002: Add Full Provenance Tracking
-- Date: October 8, 2025
-- Purpose: Transform CivicCheckYYC into enterprise-grade transparency platform
--
-- This migration adds comprehensive provenance tracking including:
-- - Socrata row-level API links and hashes
-- - Meeting agenda/minutes links (populated in Phase 1.5)
-- - Fetch and processing timestamps
-- - AI model and prompt versioning
-- - Token usage tracking

-- ============================================================================
-- Add Socrata Provenance Fields
-- ============================================================================

-- Dataset and row identifiers
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS source_dataset_id TEXT DEFAULT 'ruq3-99hx';

ALTER TABLE votes
ADD COLUMN IF NOT EXISTS source_row_id TEXT;

-- Direct API access URLs
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS source_api_url TEXT;

-- Portal/web UI links (filtered view or dataset page)
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS source_portal_url TEXT;

-- SHA-256 hash for deduplication and integrity verification
-- Format: sha256(voter|meetingdate|resolution|vote)
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS source_hash TEXT;

-- ============================================================================
-- Add Meeting Links (will be populated in Phase 1.5)
-- ============================================================================

-- Calgary Calendar event page (Trumba calendar)
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS calendar_event_url TEXT;

-- Direct links to agenda/minutes documents
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS agenda_url TEXT;

ALTER TABLE votes
ADD COLUMN IF NOT EXISTS minutes_url TEXT;

-- ============================================================================
-- Add Timestamp Tracking
-- ============================================================================

-- When was this vote record fetched from Open Data Calgary?
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;

-- When was this vote processed by AI?
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- ============================================================================
-- Add AI Provenance Fields
-- ============================================================================

-- Prompt version used for processing (e.g., "v1.0-2025-10-08")
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS prompt_version TEXT;

-- Model version with timestamp (e.g., "gpt-5-mini@2025-10-01")
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS model_version TEXT;

-- Number of completion tokens used (for cost tracking)
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS ai_response_tokens INTEGER;

-- ============================================================================
-- Add Indexes for Performance
-- ============================================================================

-- Unique index on source_hash for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_source_hash ON votes(source_hash);

-- Index on Socrata row ID for lookups
CREATE INDEX IF NOT EXISTS idx_votes_source_row_id ON votes(source_row_id);

-- Index on fetch timestamp for incremental updates
CREATE INDEX IF NOT EXISTS idx_votes_fetched_at ON votes(fetched_at DESC);

-- Index on processing timestamp
CREATE INDEX IF NOT EXISTS idx_votes_processed_at ON votes(processed_at DESC);

-- ============================================================================
-- Add Column Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN votes.source_dataset_id IS 'Socrata dataset ID (default: ruq3-99hx for Council and Committee Votes)';
COMMENT ON COLUMN votes.source_row_id IS 'Socrata row identifier (e.g., "row-p5zy~f4hc_ii6x") for exact record lookup';
COMMENT ON COLUMN votes.source_api_url IS 'Direct JSON API URL to fetch this exact vote record from Calgary Open Data';
COMMENT ON COLUMN votes.source_portal_url IS 'Web UI link to view this vote in Calgary Open Data Portal';
COMMENT ON COLUMN votes.source_hash IS 'SHA-256 hash of voter|meetingdate|resolution|vote for deduplication and integrity checks';

COMMENT ON COLUMN votes.calendar_event_url IS 'Link to Calgary Council Calendar event page (Trumba calendar)';
COMMENT ON COLUMN votes.agenda_url IS 'Direct link to meeting agenda document (PDF/HTML) if available';
COMMENT ON COLUMN votes.minutes_url IS 'Direct link to meeting minutes document (PDF/HTML) if available';

COMMENT ON COLUMN votes.fetched_at IS 'Timestamp when this vote was fetched from Open Data Calgary API';
COMMENT ON COLUMN votes.processed_at IS 'Timestamp when this vote was processed by AI to generate summaries';

COMMENT ON COLUMN votes.prompt_version IS 'Version identifier of the prompt template used for AI processing (e.g., "v1.0-2025-10-08")';
COMMENT ON COLUMN votes.model_version IS 'AI model name and date used for processing (e.g., "gpt-5-mini@2025-10-01")';
COMMENT ON COLUMN votes.ai_response_tokens IS 'Number of completion tokens generated by AI (for cost tracking and transparency)';

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Run this to verify the migration succeeded:
/*
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'votes'
  AND column_name IN (
    'source_dataset_id', 'source_row_id', 'source_api_url', 'source_portal_url', 'source_hash',
    'calendar_event_url', 'agenda_url', 'minutes_url',
    'fetched_at', 'processed_at',
    'prompt_version', 'model_version', 'ai_response_tokens'
  )
ORDER BY ordinal_position;
*/

-- Check indexes:
/*
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'votes'
  AND indexname LIKE '%source%' OR indexname LIKE '%fetched%' OR indexname LIKE '%processed%';
*/

-- ============================================================================
-- Notes for Rollback (if needed)
-- ============================================================================

-- To rollback this migration, run:
/*
ALTER TABLE votes
DROP COLUMN IF EXISTS source_dataset_id,
DROP COLUMN IF EXISTS source_row_id,
DROP COLUMN IF EXISTS source_api_url,
DROP COLUMN IF EXISTS source_portal_url,
DROP COLUMN IF EXISTS source_hash,
DROP COLUMN IF EXISTS calendar_event_url,
DROP COLUMN IF EXISTS agenda_url,
DROP COLUMN IF EXISTS minutes_url,
DROP COLUMN IF EXISTS fetched_at,
DROP COLUMN IF EXISTS processed_at,
DROP COLUMN IF EXISTS prompt_version,
DROP COLUMN IF EXISTS model_version,
DROP COLUMN IF EXISTS ai_response_tokens;

DROP INDEX IF EXISTS idx_votes_source_hash;
DROP INDEX IF EXISTS idx_votes_source_row_id;
DROP INDEX IF EXISTS idx_votes_fetched_at;
DROP INDEX IF EXISTS idx_votes_processed_at;
*/
