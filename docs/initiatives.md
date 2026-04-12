# Localize News — Project Initiatives

A living document tracking what's been built, what's in progress, and what's planned.

---

## Shipped

### Core infrastructure
- **Scraping pipeline** — Playwright-based crawler with a generic link-discovery pipeline and hand-crafted scrapers per municipality
- **Supabase schema** — `townships`, `documents`, `scrape_runs`, `scrape_requests` tables with RLS policies and `updated_at` triggers (migration 001)
- **Full-text search** — GIN index on documents for fast keyword search (migration 003)
- **Background jobs** — `pg_cron` + `pg_net` scheduled nightly scrape (migration 002)

### Scraper features
- **Adaptive queue scheduling** — back-off after empty runs (`next_scrape_at`, `consecutive_empty_runs`), reset on new docs, +2d on error (migration 005)
- **Contemporary-only scraping** — `sinceDate` filter (180-day default for nightly cron, unlimited for manual/force runs)
- **Idempotent upserts** — documents keyed on `(township_id, source_url)`, safe to re-run

### AI features
- **Per-document summaries** — Claude Haiku generates 2–3 sentence summaries for each document with enough content; stored in `documents.ai_summary` (migration 004)
- **Batch summary endpoint** — `POST /api/admin/summarize-batch` to backfill summaries for existing documents
- **AI area insights** — Claude synthesizes recent documents for a township into a 3–5 sentence area overview; stored in `townships.ai_insights` (migration 006). Auto-generated after each scrape run that produces new documents. Also available on demand via `POST /api/admin/analyze-area`.

### Admin tooling
- **Admin dashboard** (`/admin`) — township management, pending request review, scrape trigger per township, queue panel with Bump button, recent scrape run log
- **Township request flow** — public submission form; requests are queued for manual review before scraping is triggered
- **Admin auth** — shared secret via `ADMIN_SECRET` env var (session-stored in browser, sent as `x-admin-secret` header)

### Data
- **Municipal directory** — 51 curated US municipalities across all regions in `data/municipal-directory.ts`
- **Import script** — `scripts/import-directory.ts` CLI with `--dry-run`, `--state`, `--status` flags

---

## Active

- **Dataset seeding** — import the 51 municipalities into Supabase and trigger initial scrape waves via GitHub Actions workflow_dispatch
- **Directory expansion** — growing toward 150–200 municipalities with broader state and region coverage

---

## Backlog

### Data coverage
- **Hand-crafted scrapers for high-value municipalities** — agendas/minutes with structured PDFs that the generic pipeline misses
- **Expand municipal directory** — add townships, boroughs, villages; currently only cities; target 200+ total entries
- **Multi-state coverage gaps** — Hawaii, Alaska, Mountain West underrepresented

### AI features
- **Area insights display** — surface `ai_insights` on township pages and in the admin panel for analyzed areas
- **Cross-area trend analysis** — identify recurring topics (budget cuts, zoning, infrastructure) across multiple municipalities in a region

### Public-facing features
- **Public search UI** — full-text search across documents with filters by type, date range, and township
- **Township page** — document timeline, document type breakdown, MeetingDigest component surfacing AI summaries and area insights
- **Embeddable widget** — township activity summary card for third-party sites

### Infrastructure
- **User-submitted request improvements** — email notification on approval/rejection, status page for submitters
- **Proper admin auth** — replace shared-secret session storage with Supabase Auth or NextAuth
- **Scrape run notifications** — Slack or email alert when a run produces errors or unusually low document counts
