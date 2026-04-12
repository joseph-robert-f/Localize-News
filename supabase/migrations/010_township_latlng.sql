-- Migration 010: Add lat/lng columns to townships table
-- Used by CountyFocusMap to position municipality dots on the county boundary map.

alter table townships
  add column if not exists latitude  decimal(9,6),
  add column if not exists longitude decimal(9,6);
