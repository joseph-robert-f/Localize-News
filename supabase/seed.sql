-- Seed data for local development.
-- Run after applying migrations.

insert into townships (id, name, state, website_url, status) values
  ('00000000-0000-0000-0000-000000000001', 'Springfield',          'IL', 'https://www.springfield.il.us',          'active'),
  ('00000000-0000-0000-0000-000000000002', 'Shelbyville',          'IN', 'https://www.shelbyville.in.gov',         'active'),
  ('00000000-0000-0000-0000-000000000003', 'Oakdale',              'PA', 'https://www.oakdaleborough.com',         'pending'),
  ('00000000-0000-0000-0000-000000000004', 'Naperville',           'IL', 'https://www.naperville.il.us',           'active'),
  ('00000000-0000-0000-0000-000000000005', 'Ann Arbor',            'MI', 'https://www.a2gov.org',                  'active'),
  ('00000000-0000-0000-0000-000000000006', 'Cheltenham Township',  'PA', 'https://www.cheltenham-township.org',    'active')
on conflict do nothing;
