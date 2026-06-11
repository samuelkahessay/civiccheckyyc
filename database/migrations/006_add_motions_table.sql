-- Migration: Add motions table for motion-centric data model
-- This allows us to group votes by motion and eliminate duplicate motion data

-- Create motions table
CREATE TABLE motions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Core motion data (from source)
    resolution TEXT NOT NULL, -- Original resolution text from Calgary Open Data
    motion_summary TEXT, -- AI-generated human-readable summary

    -- Meeting context
    meeting_date DATE NOT NULL,
    meeting_url TEXT,
    meeting_type VARCHAR(100),

    -- Categorization
    topic VARCHAR(100), -- Housing, Transit, Budget, etc.
    impact VARCHAR(20) CHECK (impact IN ('high', 'medium', 'low')),
    report_numbers TEXT[], -- Extracted report IDs (e.g., ["C2024-1042"])

    -- Meeting links
    calendar_event_url TEXT,
    agenda_url TEXT,
    minutes_url TEXT,

    -- Source provenance
    source_dataset_id TEXT DEFAULT 'ruq3-99hx',
    source_api_url TEXT, -- API URL to a representative vote (any candidate)
    source_portal_url TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: same resolution + date = same motion
    CONSTRAINT unique_motion UNIQUE (resolution, meeting_date)
);

-- Add motion_id to votes table
ALTER TABLE votes ADD COLUMN motion_id UUID REFERENCES motions(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_motions_date ON motions(meeting_date DESC);
CREATE INDEX idx_motions_topic ON motions(topic);
CREATE INDEX idx_motions_impact ON motions(impact);
CREATE INDEX idx_motions_resolution ON motions USING gin(to_tsvector('english', resolution));
CREATE INDEX idx_votes_motion_id ON votes(motion_id);

-- Enable RLS on motions table
ALTER TABLE motions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON motions FOR SELECT USING (true);

-- Populate motions table from existing votes
-- Group by source_text (resolution) + meeting_date
INSERT INTO motions (
    resolution,
    motion_summary,
    meeting_date,
    meeting_url,
    meeting_type,
    topic,
    impact,
    report_numbers,
    calendar_event_url,
    agenda_url,
    minutes_url,
    source_dataset_id,
    source_api_url,
    source_portal_url
)
SELECT DISTINCT ON (source_text, meeting_date)
    source_text as resolution,
    motion_title as motion_summary, -- Use AI-parsed title as summary
    meeting_date,
    meeting_url,
    meeting_type,
    topic,
    impact,
    report_numbers,
    calendar_event_url,
    agenda_url,
    minutes_url,
    source_dataset_id,
    source_api_url,
    source_portal_url
FROM votes
WHERE source_text IS NOT NULL
ORDER BY source_text, meeting_date, created_at ASC;

-- Link votes to motions
UPDATE votes v
SET motion_id = m.id
FROM motions m
WHERE v.source_text = m.resolution
  AND v.meeting_date = m.meeting_date;

-- Verify migration
DO $$
DECLARE
    total_motions INTEGER;
    total_votes INTEGER;
    linked_votes INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_motions FROM motions;
    SELECT COUNT(*) INTO total_votes FROM votes;
    SELECT COUNT(*) INTO linked_votes FROM votes WHERE motion_id IS NOT NULL;

    RAISE NOTICE '=== Migration Results ===';
    RAISE NOTICE 'Created % motions', total_motions;
    RAISE NOTICE 'Total votes: %', total_votes;
    RAISE NOTICE 'Linked votes: % (%.1f%%)', linked_votes, (linked_votes::FLOAT / total_votes * 100);

    IF linked_votes < total_votes THEN
        RAISE WARNING '% votes not linked to motions (missing source_text?)', total_votes - linked_votes;
    END IF;
END $$;
