-- Migration 007: Enforce one vote per candidate per motion and clean duplicates
-- Context: After a motion deduplication step, some votes from distinct amendments were
--          incorrectly re-linked to a single motion. This created multiple vote rows
--          per (candidate_id, motion_id), which is invalid and confusing in the UI.

-- 1) Cleanup existing duplicates by keeping a single best record per (candidate_id, motion_id)
--    Preference order: 'for' > 'against' > 'absent'; tie-break on most recent updated_at, then id.
WITH ranked AS (
  SELECT
    id,
    candidate_id,
    motion_id,
    vote,
    ROW_NUMBER() OVER (
      PARTITION BY candidate_id, motion_id
      ORDER BY
        CASE vote WHEN 'for' THEN 3 WHEN 'against' THEN 2 WHEN 'absent' THEN 1 ELSE 0 END DESC,
        updated_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM votes
  WHERE motion_id IS NOT NULL
)
DELETE FROM votes v
USING ranked r
WHERE v.id = r.id
  AND r.rn > 1;

-- 2) Enforce the rule going forward with a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_candidate_motion_uniq
  ON votes(candidate_id, motion_id)
  WHERE motion_id IS NOT NULL;

-- 3) Optional verification
-- SELECT candidate_id, motion_id, COUNT(*)
-- FROM votes
-- WHERE motion_id IS NOT NULL
-- GROUP BY candidate_id, motion_id
-- HAVING COUNT(*) > 1;

