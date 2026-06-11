# CivicCheckYYC Archive

CivicCheckYYC was a civic information experiment for the 2025 Calgary municipal election. It connected Calgary Open Data voting records, candidate context, and AI-assisted plain-language summaries so voters could inspect what council candidates had done, not only what they said.

This public snapshot is archived. It is designed to run locally without Supabase, Vercel, or private credentials.

## Local Runtime

The open-source version uses a local SQLite database seeded from `frontend/data/local-seed.sql`.

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

On first run, the app creates `.local/civiccheckyyc.sqlite` from the seed file. To rebuild the local database, delete `.local/civiccheckyyc.sqlite` and restart the dev server.

## What Was Live

The live version used:

- Next.js frontend on Vercel
- Supabase Postgres for candidate, motion, vote, and enrichment tables
- Python ETL scripts for Calgary Open Data ingestion
- AI-assisted summarization and topic classification

Those cloud services are not required for this archived snapshot. The local database contains a small representative subset so the product can be inspected, tested, and screenshotted without exposing production infrastructure.

## Repository Shape

- `frontend/` - the inspectable Next.js app
- `frontend/data/local-seed.sql` - local SQLite schema and representative seed data
- `backend/` - historical ETL scripts from the live system
- `database/` - historical schema and migration references
- `PRD.md` - original product notes

## Archive Status

Shipped for the 2025 Calgary election cycle. Public app retired; code released as an inspectable case-study artifact.
