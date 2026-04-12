# Supabase Setup Guide

Step-by-step instructions for applying database migrations and configuring your Supabase project for Localize News.

---

## Prerequisites

- Access to your Supabase project dashboard
- Your project's **SQL Editor** (Dashboard → SQL Editor)
- `.env.local` filled in from `.env.example`

---

## Migrations

Migrations live in `supabase/migrations/` and are numbered sequentially. Apply them **in order** if setting up a fresh project. If you've already applied earlier ones, jump to whichever is new.

### Migration 001 — Initial schema
Creates the core tables (`townships`, `documents`, `scrape_requests`, `scrape_runs`), indexes, RLS policies, and the `updated_at` trigger.

File: `supabase/migrations/001_initial_schema.sql`

### Migration 002 — Cron jobs
Sets up the `pg_cron` + `pg_net` scheduled job that calls the scrape endpoint nightly.

File: `supabase/migrations/002_cron_jobs.sql`

> **Note:** Requires the `pg_cron` and `pg_net` extensions to be enabled. Enable them first:
> Dashboard → Database → Extensions → search "pg_cron" and "pg_net" → Enable both.

### Migration 003 — Full-text search index
Adds a `tsvector` column and GIN index on the `documents` table for faster full-text search.

File: `supabase/migrations/003_fts_index.sql`

### Migration 004 — AI summary column
Adds the `ai_summary` text column to `documents`.

File: `supabase/migrations/004_ai_summary.sql`

---

## Migration 005 — Adaptive scrape queue (apply this now)

This is the migration you need to apply after the pipeline expansion update.

It adds two columns to `townships`:
- `next_scrape_at` — when this township should next be scraped (NULL = immediately eligible)
- `consecutive_empty_runs` — how many consecutive runs returned zero new documents

And creates a partial index (`townships_queue_idx`) on active townships ordered by `next_scrape_at` for fast queue lookups.

### Step 1 — Open SQL Editor

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New query**

### Step 2 — Paste and run the migration

Copy the SQL below and paste it into the editor, then click **Run**:

```sql
alter table townships
  add column if not exists next_scrape_at timestamptz,
  add column if not exists consecutive_empty_runs int not null default 0;

create index if not exists townships_queue_idx
  on townships (next_scrape_at asc nulls first)
  where status = 'active';
```

> `add column if not exists` makes this safe to run more than once — it's a no-op if the columns already exist.

### Step 3 — Verify the columns were added

Run this query to confirm both columns appear on the `townships` table:

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_name = 'townships'
order by ordinal_position;
```

Expected output includes these two rows:

| column_name | data_type | column_default | is_nullable |
|---|---|---|---|
| next_scrape_at | timestamp with time zone | null | YES |
| consecutive_empty_runs | integer | 0 | NO |

### Step 4 — Verify the index was created

```sql
select indexname, indexdef
from pg_indexes
where tablename = 'townships' and indexname = 'townships_queue_idx';
```

You should see one row with `indexname = townships_queue_idx`.

### Step 5 — Existing active townships (no action needed)

All existing active townships automatically have `next_scrape_at = NULL`, which means they are immediately eligible on the next queue run. No backfill is required.

---

## GitHub Actions Secrets

Set these in your repository: **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL (e.g. `https://abc123.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key — bypasses RLS for scraper writes |
| `BRAVE_SEARCH_API_KEY` | Recommended | Brave Search API key (free tier: 2,000 queries/month). Falls back to DuckDuckGo scraping if unset |
| `ANTHROPIC_API_KEY` | Optional | Enables AI-generated document summaries via Claude Haiku. Documents are still scraped and indexed without it |
| `CRON_SECRET` | Yes (if using pg_cron) | Shared secret sent in the `x-cron-secret` header by the pg_cron job |

---

## Local development

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

The `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe to expose to the browser. All other keys are server-only — never use the `NEXT_PUBLIC_` prefix on them.

---

## All migrations at a glance

| File | What it does |
|---|---|
| `001_initial_schema.sql` | Core tables, RLS, indexes, updated_at trigger |
| `002_cron_jobs.sql` | pg_cron scheduled scrape job |
| `003_fts_index.sql` | Full-text search GIN index on documents |
| `004_ai_summary.sql` | ai_summary column on documents |
| `005_queue_columns.sql` | next_scrape_at + consecutive_empty_runs on townships |
