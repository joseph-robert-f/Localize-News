# Supabase Setup Guide

Step-by-step checklist to connect Localize News to a live Supabase project and go live on Vercel.

---

## Prerequisites

- [ ] Node.js 20+ installed locally
- [ ] Vercel account (or another hosting platform)
- [ ] Supabase account — free tier works for getting started

---

## 1. Create the Supabase project

- [ ] Go to [supabase.com](https://supabase.com) → **New project**
- [ ] Choose a name (e.g. `localize-news`) and a strong database password — **save this password somewhere safe**
- [ ] Select the region closest to your Vercel deployment (US East is a safe default)
- [ ] Wait for the project to finish provisioning (~60 seconds)

---

## 2. Collect your credentials

From **Project Settings → API**:

- [ ] Copy **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Copy **anon / public key** → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Copy **service_role / secret key** → this is `SUPABASE_SERVICE_ROLE_KEY`
  - ⚠️ Never expose the service role key to the browser or commit it to git

---

## 3. Configure local environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every value:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App secrets — generate with: openssl rand -hex 32
ADMIN_SECRET=<long-random-string>
CRON_SECRET=<another-long-random-string>

# Optional but recommended (see sections 8 and 9 below)
ANTHROPIC_API_KEY=
BRAVE_SEARCH_API_KEY=
```

- [ ] `NEXT_PUBLIC_SUPABASE_URL` set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `ADMIN_SECRET` set (generate with `openssl rand -hex 32`)
- [ ] `CRON_SECRET` set (generate a second one with `openssl rand -hex 32`)

---

## 4. Enable required database extensions

In the Supabase dashboard → **Database → Extensions**:

- [ ] Enable **pg_cron** (search "cron") — needed for scheduled scrape jobs
- [ ] Enable **pg_net** (search "net") — needed for pg_cron to call your API route

> Both extensions are available on all Supabase plans including free.

---

## 5. Apply migrations

Open the **SQL Editor** in the Supabase dashboard and run each file in order. Copy-paste the full contents of each file.

### Migration 1 — Core schema

- [ ] Run `supabase/migrations/001_initial_schema.sql`

Creates:
| Table | Purpose |
|---|---|
| `townships` | Each town/city being tracked (name, state, website, status) |
| `documents` | Agendas, minutes, budgets, proposals scraped from township sites |
| `scrape_requests` | Public form submissions for new townships (queued for admin review) |
| `scrape_runs` | Audit log of every scrape execution (status, doc counts, errors) |

Also enables Row Level Security (RLS) with policies:
- Public can read `townships` where `status = 'active'`
- Public can read `documents` for active townships only
- Anyone can insert into `scrape_requests` (the public request form)
- Service role has full access to all tables

### Migration 2 — Cron jobs

**Before running:** edit the file and replace **both** occurrences of `<YOUR_APP_URL>` with your production Vercel URL (e.g. `https://localize-news.vercel.app`). Do not include a trailing slash.

- [ ] Replace `<YOUR_APP_URL>` in `supabase/migrations/002_cron_jobs.sql` with your Vercel URL
- [ ] Run `supabase/migrations/002_cron_jobs.sql`

This schedules two cron jobs:
| Job | Schedule | What it does |
|---|---|---|
| `nightly-scrape-all` | 02:00 UTC daily | Scrapes all active townships for new documents |
| `weekly-full-rescrape` | 03:00 UTC Sunday | Full re-scrape with `force=true` to catch site structure changes |

### Migration 3 — Full-text search index

- [ ] Run `supabase/migrations/003_fts_index.sql`

Adds a generated `tsvector` column to `documents` with a GIN index, enabling fast full-text search across titles and content (used by `/search`).

### Migration 4 — AI summary column

- [ ] Run `supabase/migrations/004_ai_summary.sql`

Adds `ai_summary text` column to `documents` for Claude-generated 2–3 sentence summaries.

---

## 6. Set the cron secret as a database setting

This stores your `CRON_SECRET` inside the DB so pg_cron can read it without hardcoding it in the migration file.

Run this in the **SQL Editor** (replace with your actual secret):

```sql
ALTER DATABASE postgres SET app.cron_secret = '<your-CRON_SECRET-value>';
```

- [ ] Cron secret set in DB — value must exactly match `CRON_SECRET` in your `.env.local`

---

## 7. Load seed data (development / staging only)

To populate the database with test townships so the UI has something to display:

- [ ] Run `supabase/seed.sql` in the SQL Editor

This inserts 6 townships:
- Springfield, IL
- Shelbyville, IN
- Oakdale, PA (pending — won't scrape automatically)
- Naperville, IL
- Ann Arbor, MI
- Cheltenham Township, PA

> Skip this step in production — townships should be added through the admin dashboard or the public request form.

---

## 8. Verify the setup locally

```bash
npm run dev
```

- [ ] Home page loads at `http://localhost:3000` — should show 6 townships from seed
- [ ] Township detail page loads at `/townships/00000000-0000-0000-0000-000000000001`
- [ ] `/search` page loads without errors
- [ ] `/admin` page is accessible with your `ADMIN_SECRET`
- [ ] `/request` form submits and creates a row in `scrape_requests`

Verify cron jobs were created:

```sql
SELECT jobname, schedule, active FROM cron.job;
```

Expected output:
```
nightly-scrape-all     | 0 2 * * *  | true
weekly-full-rescrape   | 0 3 * * 0  | true
```

---

## 9. Deploy to Vercel

- [ ] Push your branch to GitHub (already done if you're reading the PR)
- [ ] Connect the repo to Vercel → **Import Project**
- [ ] Set all environment variables in **Vercel → Settings → Environment Variables**:

| Variable | Value source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings → API |
| `ADMIN_SECRET` | Same value as your `.env.local` |
| `CRON_SECRET` | Same value as your `.env.local` and DB setting |
| `ANTHROPIC_API_KEY` | See section 10 (optional) |
| `BRAVE_SEARCH_API_KEY` | See section 11 (optional) |

- [ ] Deploy — Vercel builds automatically on push to `main`
- [ ] Confirm the production URL works end-to-end

---

## 10. Optional — Enable AI document summaries (Anthropic)

Without this key the app works normally; documents just won't have AI summaries.

- [ ] Create an account at [console.anthropic.com](https://console.anthropic.com)
- [ ] Generate an API key
- [ ] Add `ANTHROPIC_API_KEY` to `.env.local` and Vercel environment variables
- [ ] After first scrape runs, backfill existing documents by calling:

```bash
curl -X POST https://your-app.vercel.app/api/admin/summarize-batch \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

- [ ] Visit a township page — "What's been discussed" digest should appear on the Overview tab

---

## 11. Optional — Enable reliable search (Brave Search API)

The generic scraper pipeline uses search queries to discover documents. Without a Brave key it falls back to a DuckDuckGo HTML scrape that may break if DDG changes their markup.

- [ ] Sign up at [api.search.brave.com](https://api.search.brave.com/app/) — free tier: 2,000 queries/month
- [ ] Copy your API key
- [ ] Add `BRAVE_SEARCH_API_KEY` to `.env.local` and Vercel

---

## 12. Trigger the first scrape

From the admin dashboard (`/admin`) or via API:

```bash
# Scrape a specific township (use ID from seed or DB)
curl -X POST https://your-app.vercel.app/api/scrape \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"townshipId": "00000000-0000-0000-0000-000000000004"}'
```

- [ ] First scrape runs successfully — check `/admin` for run log and document counts
- [ ] Documents appear on township page
- [ ] Search returns results

---

## Schema reference

```
townships
  id            uuid PK
  name          text
  state         text
  website_url   text
  status        'pending' | 'active' | 'error' | 'unsupported'
  last_scraped_at  timestamptz
  created_at    timestamptz
  updated_at    timestamptz

documents
  id            uuid PK
  township_id   uuid FK → townships.id
  type          'agenda' | 'minutes' | 'proposal' | 'budget' | 'other'
  title         text
  date          date
  source_url    text  (unique per township — prevents duplicates)
  content       text  (extracted PDF/HTML text)
  file_url      text  (direct PDF link if available)
  ai_summary    text  (Claude-generated summary)
  fts           tsvector generated (title + content, GIN indexed)
  scraped_at    timestamptz
  created_at    timestamptz

scrape_requests
  id            uuid PK
  township_name text
  website_url   text
  contact_email text
  notes         text
  status        'pending' | 'approved' | 'rejected'
  reviewed_at   timestamptz
  created_at    timestamptz

scrape_runs
  id                 uuid PK
  township_id        uuid FK → townships.id (nullable)
  triggered_by       'cron' | 'admin' | 'manual'
  status             'running' | 'success' | 'error'
  documents_found    int
  documents_inserted int
  error_message      text
  started_at         timestamptz
  finished_at        timestamptz
```

---

## Troubleshooting

**Cron job isn't firing**
- Confirm `pg_cron` and `pg_net` extensions are enabled
- Check `app.cron_secret` DB setting matches `CRON_SECRET` env var exactly
- Confirm `<YOUR_APP_URL>` was replaced in migration 002 before applying
- View job history: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

**"Unauthorized" on admin routes**
- `ADMIN_SECRET` in `.env.local` / Vercel must match what you send as `x-admin-secret`

**Documents not appearing publicly**
- Check township `status` is `'active'` — RLS blocks public reads on pending/error townships
- Run `SELECT status FROM townships WHERE id = '<id>';` in SQL Editor

**Search returns no results**
- Migration 003 (FTS index) must be applied
- Content needs to be extracted from PDFs — check that `content` column is not null for a few documents

**Scraper finds 0 documents**
- Run the scraper standalone to see detailed logs: `npx tsx scrapers/naperville-il.ts`
- Site structure may have changed — check the URL in `PAGES` and update selectors if needed
