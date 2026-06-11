-- Migration: Add source attribution fields to votes table
-- Run this if you've already created the votes table

-- Add report_numbers column (array of text for extracted report IDs)
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS report_numbers TEXT[];

-- Add data_source_row_id column (Socrata row ID for deep-linking)
ALTER TABLE votes
ADD COLUMN IF NOT EXISTS data_source_row_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN votes.report_numbers IS 'Extracted report IDs from resolution text (e.g., ["C2024-1042", "IGA2024-0941"])';
COMMENT ON COLUMN votes.data_source_row_id IS 'Socrata row identifier for linking back to Open Data portal (e.g., "row-p5zy~f4hc_ii6x")';
