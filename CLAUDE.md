# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Localize News** is a solo-developer platform for sourcing and visualizing local township public data — agendas, minutes, proposals, budgets, and more. External users can submit requests to have their township's data scraped and added to the platform.

Built with Next.js 16, TypeScript, and Tailwind CSS 4.

---

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Run production build
npm run lint     # Run ESLint

# Unit tests (Vitest)
npx vitest run                                      # Run all unit tests
npx vitest                                          # Watch mode
npx vitest run tests/unit/someTownship.test.ts      # Run a specific unit test

# Scraper / E2E tests (Playwright)
npx playwright test                                 # Run all Playwright tests
npx playwright test tests/e2e/someTownship.spec.ts  # Run a specific test
```

> **Always run tests before marking a task complete.**

---

## Architecture

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 + `clsx` for conditional class merging
- **Database**: Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Scraping**: Playwright
- **Testing**: Vitest (unit/integration) + Playwright Test (scraper/E2E)
- **Hosting**: Vercel (frontend + API routes); Supabase handles DB and auth infra
- **Background jobs**: `pg_cron` via Supabase for scheduled scrape runs
- **Package Manager**: npm

### Directory Structure

```
src/
  app/                      # App Router pages and layouts
    layout.tsx              # Root layout with fonts and global styles
    page.tsx                # Home page
    globals.css             # Global CSS with Tailwind imports
    api/                    # API routes (one concern per route)
    admin/                  # Admin-only pages (request review, scrape triggers)
  components/
    ui/                     # Primitives: Button, Badge, Card — Tailwind-based, no UI lib dependency
    township/               # Domain components: DocumentCard, DocumentList, StatusBadge, etc.
  lib/
    supabase.ts             # Supabase client singleton (server + browser variants)
    db/                     # Typed query helpers — no raw SQL in routes or components
    utils.ts                # clsx, date formatters, shared helpers
scrapers/                   # Playwright scraper scripts, one file per township
supabase/
  migrations/               # SQL migration files — never edit after applying
  seed.sql                  # Dev seed data
tests/
  unit/                     # Vitest unit tests
  e2e/                      # Playwright end-to-end and scraper tests
public/                     # Static assets
```

### Key Patterns

- Uses Next.js App Router (`src/app/`) — all components in this directory are React Server Components by default.
- Add `"use client"` directive only at the top of files that genuinely need client-side interactivity.
- Tailwind classes are used directly in JSX for styling; use `clsx` from `/lib/utils.ts` for conditional logic.
- Never import the Supabase client directly in components — always go through `/lib/db/` helpers.
- Use the **server client** (`createServerClient`) in Server Components and API routes; use the **browser client** only in Client Components that need real-time or auth context.

---

## Coding Conventions

- Use **TypeScript** throughout. No `any` unless absolutely necessary — prefer `unknown` + narrowing.
- Prefer **named exports** over default exports for components and utilities.
- Keep scraper logic isolated in `/scrapers`. No scraping logic inside API routes or components.
- API routes live in `src/app/api/`. Each route does one thing.
- Use **async/await** over raw Promises.
- Avoid adding new dependencies without a clear reason — prefer built-ins and existing packages first.
- Prefer readable code over clever code — this is a solo project and maintainability matters more than brevity.

### Tailwind
- Use `clsx` for all conditional class logic — no inline ternaries concatenating class strings.
- Keep long `className` values broken across lines for readability.
- Do not use arbitrary values (e.g. `w-[347px]`) unless no standard token fits.
- All color and spacing decisions should use Tailwind tokens, not hardcoded CSS.

### Supabase
- All DB mutations go through typed helpers in `/lib/db/` — raw `.from('table').insert(...)` calls do not belong in routes or components.
- Row-level security (RLS) is the source of truth for data access. Do not rely solely on API route logic to enforce permissions.
- Migration files are append-only. Never edit a migration that has already been applied — write a new one.

---

## Scraping Guidelines (Playwright)

- Each township gets its own scraper file: `/scrapers/[township-name].ts`
- Scrapers must be **idempotent** — safe to run multiple times without duplicating data.
- Always close the browser in a `finally` block.
- Scrapers return a structured result object — they do not write directly to the DB.
- Log success/failure at each step with enough detail to debug remotely.
- Fail loudly on structural changes — do not silently return empty data.

```ts
// Example scraper shape
export async function scrapeTownship(url: string): Promise<TownshipData> {
  const browser = await chromium.launch();
  try {
    // ...scraping logic
    return { agendas: [], minutes: [], budgets: [] };
  } finally {
    await browser.close();
  }
}
```

---

## Township Request Flow

- External users submit a request (township name, website URL, contact info).
- Requests are queued for manual review before scraping is triggered.
- Each township has a status: `pending` | `active` | `error` | `unsupported`.
- Never auto-scrape user-submitted URLs — always gate behind an admin approval step.

---

## Data Model Conventions

All township documents conform to a shared shape:

```ts
type TownshipDocument = {
  id: string;
  townshipId: string;
  type: "agenda" | "minutes" | "proposal" | "budget" | "other";
  title: string;
  date: string;             // ISO 8601
  sourceUrl: string;
  content: string | null;   // extracted text, if available
  fileUrl: string | null;   // original PDF/file link, if available
  scrapedAt: string;        // ISO 8601
};
```

---

## Environment Variables

All secrets live in `.env.local` (never committed). Required variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # Server-only — never expose to the browser

# App
ADMIN_SECRET=                   # Shared secret to gate admin routes (replace with proper auth later)
```

When adding a new env var:
1. Add it to `.env.local` (yours) and `.env.example` (committed, no real values).
2. Note it in this file.
3. If server-only, confirm it does **not** have the `NEXT_PUBLIC_` prefix.

---

## Important Notes

- This project uses **Next.js 16**, which may have breaking changes from earlier versions. Refer to `node_modules/next/dist/docs/` for current API documentation when uncertain about conventions.
- Do not auto-approve or merge anything — there's no CI gate, so caution is the CI.
- Do not add analytics, telemetry, or third-party tracking without being asked.
- Do not scaffold boilerplate pages or components not yet needed.
- Do not commit placeholder/TODO-heavy code as if it's done.
- When adding a new scraper, use the established pattern in `/scrapers` — don't invent new patterns.
- When touching the data model, flag if a change would break existing scrapers or API contracts.
- If something is ambiguous (e.g. how a new township should be onboarded), ask before implementing.
