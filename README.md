# Localize News

A solo-developer platform for sourcing and visualizing local township public data — agendas, meeting minutes, proposals, budgets, and more.

**Stack:** Next.js 16 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL) · Playwright · Vercel

---

## Quick start

```bash
git clone https://github.com/joseph-robert-f/localize-news
cd localize-news
npm install

cp .env.example .env.local   # fill in real values (see Environment below)

npm run dev                   # http://localhost:3000
```

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key — **server-only, never expose to browser** |
| `ADMIN_SECRET` | Yes | Shared secret to gate `/admin` and `/api/scrape` |
| `CRON_SECRET` | Yes | Secret sent by pg_cron in the `x-cron-secret` header |
| `BRAVE_SEARCH_API_KEY` | No | [Brave Search API](https://api.search.brave.com/app/) key — free tier: 2,000 req/month. Falls back to DuckDuckGo HTML scrape if unset (fragile, dev-only). |

---

## Supabase setup

Do this once after creating a new Supabase project.

### 1. Enable extensions

In the Supabase dashboard → **Database → Extensions**, enable:
- `pg_cron` (scheduled jobs)
- `pg_net` (HTTP calls from cron jobs)

### 2. Apply migrations in order

```sql
-- In the Supabase SQL editor, run each file in order:
-- supabase/migrations/001_initial_schema.sql
-- supabase/migrations/002_cron_jobs.sql  ← edit first (see step 3)
-- supabase/migrations/003_fts_index.sql
```

Or using the Supabase CLI:
```bash
supabase db push
```

### 3. Configure cron secrets

Before applying `002_cron_jobs.sql`, replace `<YOUR_APP_URL>` with your Vercel deployment URL.

Then set the DB-level secret (run in the Supabase SQL editor):
```sql
ALTER DATABASE postgres SET app.cron_secret = 'your-CRON_SECRET-value-here';
SELECT pg_reload_conf();
```

### 4. Verify cron jobs

```sql
SELECT jobname, schedule, active FROM cron.job;
-- Should show: nightly-scrape-all, weekly-full-rescrape
```

### 5. Seed dev data (optional)

```sql
-- supabase/seed.sql
```

---

## Adding a township scraper

Each township gets its own file in `/scrapers/`. The reference implementation is `scrapers/springfield-il.ts`.

### Step-by-step

**1. Copy the reference scraper**
```bash
cp scrapers/springfield-il.ts scrapers/my-township-st.ts
```

**2. Update the config at the top of the file**
```ts
const BASE_URL = "https://www.mytownship.gov";

const PAGES = {
  agendas:  `${BASE_URL}/government/meetings/agendas`,
  minutes:  `${BASE_URL}/government/meetings/minutes`,
  budgets:  `${BASE_URL}/departments/finance/budget`,
};
```

**3. Test it standalone** (no DB needed)
```bash
npx tsx scrapers/my-township-st.ts
```

Output shows found documents, titles, dates, and any errors. Iterate until it looks right.

**4. Add the township to the database**
```sql
INSERT INTO townships (name, state, website_url, status)
VALUES ('My Township', 'ST', 'https://www.mytownship.gov', 'active');
```

**5. Trigger a manual scrape from the admin dashboard**

Visit `/admin`, enter your `ADMIN_SECRET`, and click **Scrape now** next to the new township.

---

## Running tests

```bash
# Unit tests (Vitest)
npm test                                         # run all
npx vitest                                       # watch mode
npx vitest run tests/unit/utils.test.ts         # single file

# E2E tests (Playwright) — requires dev server running
npx playwright install chromium                  # first time only
npx playwright test                              # all e2e tests
npx playwright test tests/e2e/homepage.spec.ts  # single file

# Scraper integration tests (hit real websites — slow)
npx playwright test tests/e2e/scrapers/
```

---

## Architecture

```
Browser                     Next.js (Vercel)               Supabase
   │                              │                            │
   │──── GET /                    │                            │
   │     GET /townships/[id]      │──── SELECT townships ─────▶│
   │     GET /search?q=...   ─────┤──── SELECT documents ─────▶│
   │                              │                            │
   │──── POST /api/requests ──────┤──── INSERT scrape_requests▶│
   │                              │                            │
   │                         pg_cron (02:00 UTC daily)         │
   │                              │◀─── POST /api/cron/scrape ─│
   │                              │                            │
   │                    Scraper pipeline                        │
   │                    (Playwright + pdf-parse + Tesseract)    │
   │                              │──── UPSERT documents ──────▶│
```

### Key directories

```
src/
  app/                  # Next.js App Router pages and API routes
  components/           # UI primitives and domain components
  lib/
    db/                 # Typed Supabase query helpers (no raw SQL elsewhere)
    supabase.ts         # Server + browser client factories
    utils.ts            # cn(), formatDate(), truncate(), timeAgo()
scrapers/
  pipeline.ts           # Generic discovery pipeline (search + crawl + extract)
  search.ts             # SearchProvider interface: Brave (default) + DDG (fallback)
  ocr.ts                # fetchBuffer (retry + backoff), pdf-parse, Tesseract OCR
  index.ts              # Orchestrator: runs pipeline, persists via db helpers
  springfield-il.ts     # Reference township scraper
supabase/
  migrations/           # SQL migrations — apply in order, never edit after applying
  seed.sql              # Dev seed data
tests/
  unit/                 # Vitest unit tests
  e2e/                  # Playwright e2e and scraper integration tests
```

---

## Deployment (Vercel)

1. Push to GitHub — Vercel auto-deploys on merge to `main`.

2. Add all environment variables in **Vercel → Settings → Environment Variables**.

3. After first deploy, apply Supabase migrations and set `app.cron_secret`.

4. Verify the cron endpoint is reachable:
```bash
curl -X POST https://your-app.vercel.app/api/cron/scrape \
  -H "x-cron-secret: your-CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"manual"}'
```

---

## Commands reference

```bash
npm run dev            # Start dev server (http://localhost:3000)
npm run build          # Production build
npm run start          # Run production build locally
npm run lint           # ESLint
npm test               # Vitest unit tests
npm run test:watch     # Vitest watch mode
npm run test:coverage  # Vitest with coverage report
npx playwright test    # Playwright e2e tests
```
