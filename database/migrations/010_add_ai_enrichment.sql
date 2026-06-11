-- Migration 010: AI Enrichment storage (JSONB columns + new tables)
-- Safely adds JSONB columns to candidates and creates motion_explainers, pairwise_briefs, qa_bank.

-- 1) Add JSONB columns to candidates (Ballot Brief, Topic Stances, Position Vector)
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS ai_ballot_brief JSONB,
  ADD COLUMN IF NOT EXISTS ai_topic_stances JSONB,
  ADD COLUMN IF NOT EXISTS ai_position_vector JSONB;

COMMENT ON COLUMN candidates.ai_ballot_brief IS 'AI Ballot-Ready Brief JSON (brief, strengths, tradeoffs, top_votes, citations)';
COMMENT ON COLUMN candidates.ai_topic_stances IS 'Per-topic stance JSON keyed by topic_slug with citations and confidence';
COMMENT ON COLUMN candidates.ai_position_vector IS 'Algorithmic stance vectors and consistency metric';

-- 2) Motion explainers table (since no canonical motions table exists yet)
CREATE TABLE IF NOT EXISTS motion_explainers (
  motion_key TEXT PRIMARY KEY, -- e.g., first report number or title|date fallback
  data JSONB NOT NULL,         -- { eli5, why_it_matters, key_impacts[], citations[] }
  prompt_version TEXT,
  model_version TEXT,
  ai_model_used TEXT,
  ai_response_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE motion_explainers IS 'High-impact motion explainers keyed by a stable motion_key (report number preferred)';

-- 3) Pairwise briefs table
CREATE TABLE IF NOT EXISTS pairwise_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_a_slug TEXT NOT NULL,
  candidate_b_slug TEXT NOT NULL,
  data JSONB NOT NULL,         -- { agree[], disagree[], notable_agreement, meaningful_contrast, citations[] }
  prompt_version TEXT,
  model_version TEXT,
  ai_model_used TEXT,
  ai_response_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pairwise_briefs_unique UNIQUE (candidate_a_slug, candidate_b_slug)
);

CREATE INDEX IF NOT EXISTS idx_pairwise_candidates ON pairwise_briefs(candidate_a_slug, candidate_b_slug);

COMMENT ON TABLE pairwise_briefs IS 'Pairwise comparison briefs between two candidates with citations';

-- 4) QA bank table (curated, reusable answers)
CREATE TABLE IF NOT EXISTS qa_bank (
  slug TEXT PRIMARY KEY,       -- stable key for the QA (e.g., transit-forward)
  question TEXT NOT NULL,
  data JSONB NOT NULL,         -- { answer, citations[] }
  prompt_version TEXT,
  model_version TEXT,
  ai_model_used TEXT,
  ai_response_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE qa_bank IS 'Reusable citizen Q&A answers with citations';

-- 5) Enable RLS and public read access on new tables (match existing policy style)
ALTER TABLE motion_explainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairwise_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_bank ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'motion_explainers' AND policyname = 'Public read access'
  ) THEN
    CREATE POLICY "Public read access" ON motion_explainers FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pairwise_briefs' AND policyname = 'Public read access'
  ) THEN
    CREATE POLICY "Public read access" ON pairwise_briefs FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'qa_bank' AND policyname = 'Public read access'
  ) THEN
    CREATE POLICY "Public read access" ON qa_bank FOR SELECT USING (true);
  END IF;
END $$;

-- Done.

