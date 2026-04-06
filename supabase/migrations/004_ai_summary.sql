-- Migration: 004_ai_summary
-- Adds AI-generated summary column to the documents table.
-- Apply AFTER 001_initial_schema.sql.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_summary text;
