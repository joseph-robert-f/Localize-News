-- Seed data for local development.
-- Run after applying migrations.

insert into townships (id, name, state, website_url, status) values
  ('00000000-0000-0000-0000-000000000001', 'Springfield', 'IL', 'https://www.springfield.il.us', 'active'),
  ('00000000-0000-0000-0000-000000000002', 'Shelbyville', 'IN', 'https://www.shelbyville.in.gov', 'active'),
  ('00000000-0000-0000-0000-000000000003', 'Oakdale', 'PA', 'https://www.oakdaleborough.com', 'pending')
on conflict do nothing;
