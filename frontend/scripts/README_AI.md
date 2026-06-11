AI Enrichment Scripts

This folder contains optional, server‑side scripts to enrich motions and provide news context using OpenAI and external news APIs. These scripts are NOT used by the web app directly; run them locally or in a secure backend job with proper credentials.

Environment

- Copy `scripts/.env.scripts.example` to `.env.scripts` and fill values.
- Do NOT expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or commit real keys.

Scripts

- `node scripts/ai_backfill_motion_summaries.mjs`
  - Fills/updates `motions.motion_summary`, `motions.topic`, and `motions.impact` using OpenAI from the original `resolution` text.
  - Selects motions where any of those fields is null (override with CLI options).
  - Safe to run multiple times; it only updates changed rows.

- `node scripts/ai_enrich_motion_news.mjs`
  - Finds recent motions and searches for relevant local/regional news coverage.
  - Inserts results into `public.motion_articles` (see SQL below).
  - Optionally uses OpenAI to re‑rank and summarize the article relevance.

Required SQL (one‑time)

Run this in your Supabase SQL editor (adjust schema if needed):

```
-- News articles attached to motions
create table if not exists public.motion_articles (
  id uuid primary key default gen_random_uuid(),
  motion_id uuid not null references public.motions(id) on delete cascade,
  title text not null,
  url text not null,
  source text,
  published_at timestamptz,
  description text,
  relevance_score numeric,
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  ai_summary text,
  ai_highlights jsonb,
  search_query text,
  created_at timestamptz default now()
);

create unique index if not exists motion_articles_motion_id_url_key
  on public.motion_articles (motion_id, url);
```

CLI Options

- `ai_backfill_motion_summaries.mjs`
  - `--limit 50` limit number of motions processed
  - `--only-missing` only process when summary/topic/impact is null (default)
  - `--force` always regenerate values

- `ai_enrich_motion_news.mjs`
  - `--days 30` only consider motions within N days
  - `--limit 25` limit motions processed
  - `--per-motion 3` max articles to store per motion
  - `--provider bing|newsapi|rss` choose article source

Env file for scripts

See `scripts/.env.scripts.example` for required values and provider choices.

Notes

- These scripts use the Supabase service role key for writes. Keep it server‑side.
- The OpenAI step is deterministic (temperature 0) and returns compact JSON.
- For production, consider queuing, retries, and cost/timing controls.

