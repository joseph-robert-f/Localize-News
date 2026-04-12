-- Add topics array to documents for AI-extracted topic tags
alter table documents add column if not exists topics text[];

-- GIN index enables efficient filtering/search on topics values
create index if not exists documents_topics_gin on documents using gin(topics);
