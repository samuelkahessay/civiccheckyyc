# Setting Up Candidate Links (Wikipedia & Social)

## Issue
The Wikipedia and social links are not appearing on candidate pages because:
1. The database migration has not been run yet
2. The candidate records don't have URL data populated

## Solution

### Step 1: Run Database Migration

The migration file has been created at: `database/migrations/005_add_wikipedia_url_field.sql`

**To apply the migration:**

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `database/migrations/005_add_wikipedia_url_field.sql`
4. Copy and paste the SQL:
   ```sql
   ALTER TABLE candidates
   ADD COLUMN wikipedia_url TEXT;

   COMMENT ON COLUMN candidates.wikipedia_url IS 'Wikipedia page URL for the candidate';
   ```
5. Click **Run** to execute the migration

### Step 2: Populate Candidate URLs

After running the migration, you need to add URLs to your candidate records.

**Example SQL to update candidates with URLs:**

```sql
-- Update Jyoti Gondek
UPDATE candidates
SET
  website = 'https://www.jyotigondek.ca',
  wikipedia_url = 'https://en.wikipedia.org/wiki/Jyoti_Gondek'
WHERE slug = 'jyoti-gondek';

-- Update Jeromy Farkas
UPDATE candidates
SET
  wikipedia_url = 'https://en.wikipedia.org/wiki/Jeromy_Farkas'
WHERE slug = 'jeromy-farkas';

-- Update Sonya Sharp
UPDATE candidates
SET
  wikipedia_url = 'https://en.wikipedia.org/wiki/Sonya_Sharp'
WHERE slug = 'sonya-sharp';

-- Add more candidates as needed...
```

### Step 3: Verify

After running the updates:
1. Refresh your candidate page (e.g., `/candidates/jyoti-gondek`)
2. You should see the "Links" section appear in the candidate header
3. Links will show both "Official Website" and "Wikipedia" buttons (if both URLs are populated)

## Notes

- The Links section only appears if at least one URL (website OR wikipedia_url) is populated
- Both fields are optional - candidates can have one, both, or neither
- The UI is already fully implemented and will automatically show links once the data is populated
- Links open in a new tab with `rel="noopener noreferrer"` for security

## Code Location

The Links UI is implemented in: `frontend/app/candidates/[slug]/page.tsx` (lines 72-111)
