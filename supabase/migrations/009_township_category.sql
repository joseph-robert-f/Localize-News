-- Add category and population columns to townships.
-- category: one of city | township | borough | village | town
--           (NULL for rows imported before this migration)
-- population: most recent Census estimate (optional, informational only)

alter table townships
  add column if not exists category text,
  add column if not exists population integer;

-- Index for filtering by category within a state
create index if not exists townships_state_category
  on townships (state, category);
