-- Add county column to townships table.
-- Populated at import time from the municipal directory.
-- NULL for records imported before this migration or without county data.

alter table townships
  add column if not exists county text;

-- Index for filtering/grouping by county within a state
create index if not exists townships_state_county
  on townships (state, county);
