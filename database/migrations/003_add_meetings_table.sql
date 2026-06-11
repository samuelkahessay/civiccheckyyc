-- ============================================================================
-- Migration: 003_add_meetings_table.sql
-- Description: Create meetings table for Phase 1.5 (Meeting Agenda/Minutes Links)
-- Date: 2025-10-08
-- ============================================================================

-- Purpose:
-- This migration creates a meetings table to store meeting metadata from:
-- 1. Calgary Open Data calendar dataset (23m4-i42g) - for Trumba calendar links
-- 2. eScribe meeting system - for agenda/minutes URLs
--
-- This table will be joined with votes during upload to populate:
-- - calendar_event_url
-- - agenda_url
-- - minutes_url

-- Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Create meetings table
-- ============================================================================

CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Meeting identification
    meeting_date DATE NOT NULL,
    meeting_type TEXT NOT NULL,
    normalized_type TEXT, -- Standardized type for matching with votes

    -- Calgary Calendar / Trumba links
    calendar_event_url TEXT, -- Trumba calendar event page
    calendar_event_id TEXT, -- Trumba event ID extracted from URL

    -- eScribe meeting system links
    escriba_meeting_id TEXT, -- eScribe meeting GUID (e.g., "c178e743-5a67-4e79-aab2-b375479f1ae5")
    escriba_meeting_url TEXT, -- Full eScribe meeting page URL
    agenda_url TEXT, -- Direct link to agenda document (PDF/HTML)
    minutes_url TEXT, -- Direct link to minutes document (PDF/HTML)

    -- Metadata
    source_dataset_id TEXT DEFAULT '23m4-i42g', -- Calgary Council Calendar dataset
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure no duplicate meetings
    CONSTRAINT unique_meeting_date_type UNIQUE (meeting_date, normalized_type)
);

-- ============================================================================
-- Indexes for efficient lookups
-- ============================================================================

-- Index for vote matching (most common query)
CREATE INDEX IF NOT EXISTS idx_meetings_date_normalized_type
ON meetings(meeting_date, normalized_type);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_meetings_date
ON meetings(meeting_date DESC);

-- Index for finding meetings by eScribe ID
CREATE INDEX IF NOT EXISTS idx_meetings_escriba_id
ON meetings(escriba_meeting_id)
WHERE escriba_meeting_id IS NOT NULL;

-- Index for recently updated meetings
CREATE INDEX IF NOT EXISTS idx_meetings_updated_at
ON meetings(updated_at DESC);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE meetings IS 'Meeting metadata from Calgary Open Data calendar and eScribe system';

COMMENT ON COLUMN meetings.meeting_date IS 'Date of the meeting (normalized to Calgary local date)';
COMMENT ON COLUMN meetings.meeting_type IS 'Original meeting type from source (e.g., "Council meeting - Regular")';
COMMENT ON COLUMN meetings.normalized_type IS 'Standardized meeting type for matching with votes dataset (e.g., "Regular Meeting of Council")';

COMMENT ON COLUMN meetings.calendar_event_url IS 'Link to Trumba calendar event page (from dataset 23m4-i42g)';
COMMENT ON COLUMN meetings.calendar_event_id IS 'Trumba event ID extracted from calendar_event_url';

COMMENT ON COLUMN meetings.escriba_meeting_id IS 'eScribe meeting GUID used in Meeting.aspx?Id={guid}';
COMMENT ON COLUMN meetings.escriba_meeting_url IS 'Full URL to eScribe meeting page';
COMMENT ON COLUMN meetings.agenda_url IS 'Direct link to meeting agenda document';
COMMENT ON COLUMN meetings.minutes_url IS 'Direct link to meeting minutes document';

COMMENT ON COLUMN meetings.source_dataset_id IS 'Socrata dataset ID where meeting was sourced (default: 23m4-i42g)';
COMMENT ON COLUMN meetings.fetched_at IS 'When meeting metadata was first fetched';
COMMENT ON COLUMN meetings.updated_at IS 'When meeting metadata was last updated';

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Verify table was created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meetings') THEN
        RAISE NOTICE '✓ meetings table created successfully';
    ELSE
        RAISE EXCEPTION '✗ Failed to create meetings table';
    END IF;
END $$;

-- Count indexes
SELECT COUNT(*) AS index_count
FROM pg_indexes
WHERE tablename = 'meetings';

-- Expected output: 4 indexes

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

-- To rollback this migration, run:
-- DROP TABLE IF EXISTS meetings CASCADE;
