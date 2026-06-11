-- ============================================================================
-- Migration: 009_add_platform_stances_table.sql
-- Description: Store AI-extracted platform stances with source quote links
-- Date: 2025-10-09
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS platform_stances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    campaign_page_id UUID REFERENCES campaign_pages(id) ON DELETE CASCADE,

    topic TEXT,              -- Should align with VALID_TOPICS where possible
    title TEXT NOT NULL,     -- Short label for the stance
    stance_summary TEXT,     -- One-sentence explanation of the stance
    quote TEXT NOT NULL,     -- Verbatim quote from the page

    source_url TEXT NOT NULL,         -- Original page URL
    source_scroll_url TEXT,           -- URL with scroll-to-text fragment

    confidence TEXT DEFAULT 'ai_generated', -- ai_generated, under_review, verified
    stance_hash TEXT UNIQUE,          -- sha256(candidate_id + campaign_page_id + quote)

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_platform_stances_candidate ON platform_stances(candidate_id);
CREATE INDEX IF NOT EXISTS idx_platform_stances_topic ON platform_stances(topic);
CREATE INDEX IF NOT EXISTS idx_platform_stances_page ON platform_stances(campaign_page_id);
CREATE INDEX IF NOT EXISTS idx_platform_stances_created ON platform_stances(created_at DESC);

ALTER TABLE platform_stances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON platform_stances FOR SELECT USING (true);

COMMENT ON TABLE platform_stances IS $$AI-extracted stances from campaign_pages with verbatim quotes and scroll-to-text links.$$;

-- Rollback hint:
-- DROP TABLE IF EXISTS platform_stances CASCADE;

