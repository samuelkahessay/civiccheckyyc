# CivicCheckYYC Archive

CivicCheckYYC was a civic information experiment for the 2025 Calgary municipal election. It connected Calgary Open Data voting records, candidate context, and AI-assisted plain-language summaries so voters could inspect what council candidates had done, not only what they said.

This public snapshot is archived. It is designed to run locally without cloud services or secret credentials.

## Local Runtime

The archive uses a local SQLite database seeded from `frontend/data/local-seed.sql`.

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

On first run, the app creates `.local/civiccheckyyc.sqlite` from the seed file. To rebuild the local database, delete `.local/civiccheckyyc.sqlite` and restart the dev server.

## What You Can Learn From

- how a public civic dashboard can be structured in Next.js
- how candidate, motion, vote, and source-attribution data fit together
- how to keep an archived app inspectable with a small local seed dataset

The local database contains a representative subset of the original data so the product can be inspected, tested, and screenshotted without needing external infrastructure.

## Repository Shape

- `frontend/` - the inspectable Next.js app
- `frontend/data/local-seed.sql` - local SQLite schema and representative seed data
- `frontend/lib/localData.ts` - local SQLite access layer used by the app

## Build Check

```bash
cd frontend
npm run build
```

## Archive Status

Shipped for the 2025 Calgary election cycle. Public app retired; code released as an inspectable case-study artifact.
