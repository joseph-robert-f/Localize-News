-- Migration: 002_cron_jobs
-- Sets up pg_cron scheduled scrape jobs.
-- Requires the pg_cron extension to be enabled in your Supabase project
-- (Database → Extensions → pg_cron).
--
-- The cron job calls our Next.js API route via pg_net (http extension).
-- Replace <YOUR_APP_URL> with your production Vercel URL before applying.

-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─── Nightly scrape: all active townships ────────────────────────────────────
-- Runs daily at 02:00 UTC.
-- Calls POST /api/cron/scrape with the shared CRON_SECRET header.
select cron.schedule(
  'nightly-scrape-all',             -- job name (must be unique)
  '0 2 * * *',                      -- cron expression: 02:00 UTC daily
  $$
    select net.http_post(
      url     := '<YOUR_APP_URL>/api/cron/scrape',
      headers := jsonb_build_object(
        'Content-Type',       'application/json',
        'x-cron-secret',      current_setting('app.cron_secret', true)
      ),
      body    := '{"trigger":"cron"}'::jsonb
    );
  $$
);

-- ─── Weekly full re-scrape: catches structural website changes ────────────────
-- Runs every Sunday at 03:00 UTC with force=true to re-fetch all docs.
select cron.schedule(
  'weekly-full-rescrape',
  '0 3 * * 0',
  $$
    select net.http_post(
      url     := '<YOUR_APP_URL>/api/cron/scrape',
      headers := jsonb_build_object(
        'Content-Type',       'application/json',
        'x-cron-secret',      current_setting('app.cron_secret', true)
      ),
      body    := '{"trigger":"cron","force":true}'::jsonb
    );
  $$
);

-- ─── Storing the cron secret as a DB setting ─────────────────────────────────
-- Run this manually in the Supabase SQL editor after setting the secret:
--   alter database postgres set app.cron_secret = '<your-secret-here>';
--
-- This avoids hardcoding the secret in migration files.

-- ─── Viewing scheduled jobs ───────────────────────────────────────────────────
-- To inspect jobs:   select * from cron.job;
-- To view run logs:  select * from cron.job_run_details order by start_time desc limit 20;
-- To unschedule:     select cron.unschedule('nightly-scrape-all');
