-- Migration 006: AI area insights columns on townships
-- Adds ai_insights (freeform synthesis text) and insights_updated_at (last generation timestamp).
-- Generated automatically after each scrape run that produces new documents,
-- or on demand via POST /api/admin/analyze-area.

alter table townships
  add column if not exists ai_insights text,
  add column if not exists insights_updated_at timestamptz;
