-- Migration 005: Add wikipedia_url field to candidates table
-- This allows storing Wikipedia links for candidates
-- Run this in Supabase SQL Editor

ALTER TABLE candidates
ADD COLUMN wikipedia_url TEXT;

COMMENT ON COLUMN candidates.wikipedia_url IS 'Wikipedia page URL for the candidate';
