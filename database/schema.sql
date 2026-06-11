-- CivicCheckYYC Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Candidates table
CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL, -- for URLs (e.g., 'jyoti-gondek')
    "current_role" VARCHAR(255),
    photo_url TEXT,
    website TEXT,
    wikipedia_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes table
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    motion_title TEXT NOT NULL,
    motion_summary TEXT,
    vote VARCHAR(20) CHECK (vote IN ('for', 'against', 'absent')) NOT NULL,
    meeting_date DATE NOT NULL,
    meeting_url TEXT,
    meeting_type VARCHAR(100), -- e.g., "Council", "Audit Committee"
    topic VARCHAR(100), -- Housing, Transit, Budget, etc.
    impact VARCHAR(20) CHECK (impact IN ('high', 'medium', 'low')), -- AI-generated impact assessment
    confidence VARCHAR(20) CHECK (confidence IN ('ai_generated', 'under_review', 'verified')) DEFAULT 'ai_generated',
    ai_extraction_notes TEXT,
    verified_by VARCHAR(255),
    verified_at TIMESTAMP WITH TIME ZONE,
    source_text TEXT, -- Store original resolution text for verification
    report_numbers TEXT[], -- Extracted report IDs (e.g., ["C2024-1042", "IGA2024-0941"])

    -- Socrata provenance (Phase 1)
    source_dataset_id TEXT DEFAULT 'ruq3-99hx', -- Calgary Council and Committee Votes dataset
    source_row_id TEXT, -- Socrata row identifier (e.g., "row-p5zy~f4hc_ii6x")
    source_api_url TEXT, -- Direct JSON API URL for this vote record
    source_portal_url TEXT, -- Web UI link to view in Calgary Open Data Portal
    source_hash TEXT, -- SHA-256(voter|meetingdate|resolution|vote) for deduplication
    data_source_row_id TEXT, -- DEPRECATED: Use source_row_id instead

    -- Meeting links (Phase 1.5 - populated by meeting indexer)
    calendar_event_url TEXT, -- Calgary Council Calendar event page
    agenda_url TEXT, -- Direct link to meeting agenda (PDF/HTML)
    minutes_url TEXT, -- Direct link to meeting minutes (PDF/HTML)

    -- Timestamps
    fetched_at TIMESTAMP WITH TIME ZONE, -- When fetched from Open Data Calgary
    processed_at TIMESTAMP WITH TIME ZONE, -- When processed by AI

    -- AI provenance
    prompt_version TEXT, -- Prompt template version (e.g., "v1.0-2025-10-08")
    model_version TEXT, -- AI model with date (e.g., "gpt-5-mini@2025-10-01")
    ai_response_tokens INTEGER, -- Completion tokens used (for cost tracking)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_votes_candidate ON votes(candidate_id);
CREATE INDEX idx_votes_confidence ON votes(confidence);
CREATE INDEX idx_votes_topic ON votes(topic);
CREATE INDEX idx_votes_impact ON votes(impact);
CREATE INDEX idx_votes_date ON votes(meeting_date DESC);

-- Provenance indexes (Phase 1)
CREATE UNIQUE INDEX idx_votes_source_hash ON votes(source_hash);
CREATE INDEX idx_votes_source_row_id ON votes(source_row_id);
CREATE INDEX idx_votes_fetched_at ON votes(fetched_at DESC);
CREATE INDEX idx_votes_processed_at ON votes(processed_at DESC);

-- Enable Row Level Security
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Public read access policies
CREATE POLICY "Public read access" ON candidates FOR SELECT USING (true);
CREATE POLICY "Public read access" ON votes FOR SELECT USING (true);

-- Insert the 9 mayoral candidates for Calgary 2025 election
INSERT INTO candidates (name, slug, "current_role", website, bio) VALUES
(
    'Jyoti Gondek',
    'jyoti-gondek',
    'Incumbent Mayor',
    NULL,
    'Current mayor of Calgary (non-partisan municipal office), elected in 2021 as the city''s first female mayor. Former Ward 3 councillor.'
),
(
    'Jeromy Farkas',
    'jeromy-farkas',
    'Former Ward 11 Councillor',
    NULL,
    'Former Ward 11 councillor who ran for mayor in 2021.'
),
(
    'Jeff Davison',
    'jeff-davison',
    'Former Councillor',
    NULL,
    '2021 mayoral candidate and former Calgary city councillor.'
),
(
    'Sonya Sharp',
    'sonya-sharp',
    'Ward 1 Councillor',
    NULL,
    'Current Ward 1 councillor since 2021. Running with Communities First party.'
),
(
    'Grant Prior',
    'grant-prior',
    'Directional Driller',
    NULL,
    'Directional driller with nearly 20 years in the oilpatch. Campaigns on supporting working-class Calgarians and human-centred capitalism.'
),
(
    'Brian Thiessen',
    'brian-thiessen',
    'Employment Lawyer',
    NULL,
    'Employment lawyer and former managing partner who chaired the Calgary Police Commission from 2016 to 2019. Running with The Calgary Party.'
),
(
    'Sarah Elder',
    'sarah-elder',
    'Business Owner',
    NULL,
    'Owner of Madame Premier, a political clothing shop in Inglewood, since 2019.'
),
(
    'Jaeger Gustafson',
    'jaeger-gustafson',
    'Doctor of Acupuncture',
    NULL,
    'Co-founder and doctor of acupuncture with Vitae Integralis.'
),
(
    'Larry Heather',
    'larry-heather',
    'Frequent Candidate',
    NULL,
    'Frequent Calgary election candidate.'
);
