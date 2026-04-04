-- Migration: 001_initial_schema
-- Creates core tables for townships, documents, and scrape requests.
-- Apply once against your Supabase project.

-- ─── Townships ───────────────────────────────────────────────────────────────
create table if not exists townships (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  state       text not null,
  website_url text not null,
  status      text not null default 'pending'
                check (status in ('pending', 'active', 'error', 'unsupported')),
  last_scraped_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists townships_name_state_idx on townships (lower(name), lower(state));

-- ─── Documents ───────────────────────────────────────────────────────────────
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  township_id  uuid not null references townships(id) on delete cascade,
  type         text not null
                 check (type in ('agenda', 'minutes', 'proposal', 'budget', 'other')),
  title        text not null,
  date         date,
  source_url   text not null,
  content      text,
  file_url     text,
  scraped_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Prevents duplicate documents from repeated scrape runs (idempotency)
create unique index if not exists documents_township_source_idx
  on documents (township_id, source_url);

create index if not exists documents_township_date_idx
  on documents (township_id, date desc);

-- ─── Scrape Requests (user-submitted townships) ───────────────────────────────
create table if not exists scrape_requests (
  id           uuid primary key default gen_random_uuid(),
  township_name text not null,
  website_url   text not null,
  contact_email text,
  notes         text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- ─── Scrape Runs (audit log for each cron execution) ─────────────────────────
create table if not exists scrape_runs (
  id           uuid primary key default gen_random_uuid(),
  township_id  uuid references townships(id) on delete set null,
  triggered_by text not null default 'cron'
                 check (triggered_by in ('cron', 'admin', 'manual')),
  status       text not null default 'running'
                 check (status in ('running', 'success', 'error')),
  documents_found    int not null default 0,
  documents_inserted int not null default 0,
  error_message      text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table townships      enable row level security;
alter table documents      enable row level security;
alter table scrape_requests enable row level security;
alter table scrape_runs    enable row level security;

-- Public read on active townships and their documents
create policy "Public can read active townships"
  on townships for select using (status = 'active');

create policy "Public can read documents for active townships"
  on documents for select
  using (
    exists (
      select 1 from townships t
      where t.id = documents.township_id
        and t.status = 'active'
    )
  );

-- Scrape requests: anyone can insert (the request form), only service role reads/updates
create policy "Anyone can submit scrape requests"
  on scrape_requests for insert with check (true);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger townships_set_updated_at
  before update on townships
  for each row execute procedure set_updated_at();
