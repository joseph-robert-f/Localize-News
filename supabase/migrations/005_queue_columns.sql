-- Migration 005: Adaptive scrape queue columns
--
-- Adds `next_scrape_at` and `consecutive_empty_runs` to the townships table so
-- the scraper orchestrator can back off on quiet townships instead of hitting
-- every active township every night.
--
-- Existing active townships get next_scrape_at = NULL (immediately eligible).

alter table townships
  add column if not exists next_scrape_at timestamptz,
  add column if not exists consecutive_empty_runs int not null default 0;

-- Partial index on active townships ordered by next_scrape_at so queue
-- lookups (IS NULL or <= now(), ascending) are fast.
create index if not exists townships_queue_idx
  on townships (next_scrape_at asc nulls first)
  where status = 'active';
