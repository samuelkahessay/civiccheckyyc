-- ============================================================================
-- Migration: 008_add_campaign_pages_table.sql
-- Description: Create campaign_pages table to store scraped content from
--              candidates' official campaign websites.
-- Date: 2025-10-09
-- ============================================================================

-- Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create campaign_pages table
CREATE TABLE IF NOT EXISTS campaign_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key to candidate
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,

    -- Page metadata
    url TEXT NOT NULL,
    url_normalized TEXT, -- lowercase, no fragment, canonicalized path
    status_code INTEGER,
    title TEXT,
    page_type TEXT, -- one of: platform, about, news, other (heuristic)
    language TEXT,  -- ISO code if detected (e.g., 'en')

    -- Extracted content
    content TEXT,         -- main readable text
    content_hash TEXT,    -- sha256(content) for dedupe/versioning

    -- Crawl provenance
    source_domain TEXT,   -- e.g., 'example.com'
    crawled_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure we do not duplicate the same page per candidate
    CONSTRAINT uniq_candidate_url UNIQUE (candidate_id, url)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_campaign_pages_candidate ON campaign_pages(candidate_id);
CREATE INDEX IF NOT EXISTS idx_campaign_pages_url_norm ON campaign_pages(url_normalized);
CREATE INDEX IF NOT EXISTS idx_campaign_pages_type ON campaign_pages(page_type);
CREATE INDEX IF NOT EXISTS idx_campaign_pages_crawled_at ON campaign_pages(crawled_at DESC);

-- Enable Row Level Security
ALTER TABLE campaign_pages ENABLE ROW LEVEL SECURITY;

-- Public read access (same as candidates/votes)
CREATE POLICY "Public read access" ON campaign_pages FOR SELECT USING (true);

-- Comments for documentation
COMMENT ON TABLE campaign_pages IS $$Scraped pages and extracted text from candidates' official campaign websites.$$;
COMMENT ON COLUMN campaign_pages.page_type IS 'Heuristic page classification: platform, about, news, other';
COMMENT ON COLUMN campaign_pages.content IS 'Readable main text extracted from the page (HTML removed).';

-- Verification
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_pages') THEN
        RAISE NOTICE '✓ campaign_pages table created successfully';
    ELSE
        RAISE EXCEPTION '✗ Failed to create campaign_pages table';
    END IF;
END $$;

-- Rollback hint:
-- DROP TABLE IF EXISTS campaign_pages CASCADE;
