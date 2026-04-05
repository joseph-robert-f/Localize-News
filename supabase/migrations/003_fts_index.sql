-- Migration: 003_fts_index
-- Adds a full-text search vector to the documents table.
-- Apply AFTER 001_initial_schema.sql.
--
-- Uses a generated tsvector column (Postgres 12+) so the index stays in sync
-- automatically on every INSERT/UPDATE — no trigger needed.

-- Add generated tsvector column (concatenates title + content, weighted)
alter table documents
  add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) stored;

-- GIN index for fast full-text search
create index if not exists documents_fts_idx on documents using gin(fts);

-- Optional: useful for debugging
-- To test: SELECT title, ts_rank(fts, query) AS rank
--          FROM documents, to_tsquery('english', 'agenda') query
--          WHERE fts @@ query
--          ORDER BY rank DESC LIMIT 10;
