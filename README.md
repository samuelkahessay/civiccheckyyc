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

On first run, the app creates `.local/civiccheckyyc-v2.sqlite` from the seed file. To rebuild the local database, delete that file and restart the dev server.

## What You Can Learn From

- how a public civic dashboard can be structured in Next.js
- how candidate, motion, vote, and source-attribution data fit together
- how to keep an archived app inspectable with a small local seed dataset

The local database is a small, real slice of the original data: seven contested council decisions from 2021 to 2024 and how the top four finishers in the 2025 mayoral race, all current or former councillors, voted on them. Every vote is a verbatim row from Calgary Open Data's [Council and Committee Votes](https://data.calgary.ca/Government/Council-and-Committee-Votes/ruq3-99hx) dataset, stored with its source row id, and each motion carries the whole-council result. Regenerate it with:

```bash
python3 scripts/build_local_seed.py
```

The original app also showed AI-written candidate briefs, topic stances, campaign quotes, and head-to-head comparisons. Those are not included in this snapshot because they could not be re-verified against their sources.

## Repository Shape

- `frontend/` - the inspectable Next.js app
- `frontend/data/local-seed.sql` - local SQLite schema and seed data built from Calgary Open Data
- `scripts/build_local_seed.py` - regenerates the seed from the source dataset
- `frontend/lib/localData.ts` - local SQLite access layer used by the app

## Build Check

```bash
cd frontend
npm run build
```

## Archive Status

Shipped for the 2025 Calgary election cycle. Public app retired; code released as an inspectable case-study artifact.
