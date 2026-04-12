-- Migration: 004_ai_summary
-- Adds an AI-generated summary column to the documents table.
-- Apply AFTER 003_fts_index.sql.
--
-- The ai_summary column stores a Claude-generated 2-3 sentence summary
-- of each document. It is populated by calling /api/admin/summarize-batch
-- after documents have been scraped and indexed.

alter table documents
  add column if not exists ai_summary text;

-- Optional: useful for monitoring summary coverage
-- SELECT
--   count(*) filter (where ai_summary is not null) as summarized,
--   count(*) as total
-- FROM documents;
