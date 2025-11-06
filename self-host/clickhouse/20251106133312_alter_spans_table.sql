-- migrate:up
alter table spans
add column if not exists team_id UUID CODEC(ZSTD(3)) first,
add column if not exists inserted_at DateTime DEFAULT now() CODEC(Delta, ZSTD(3)) after app_id;

-- migrate:down
alter table events
drop column if exists team_id,
drop column if exists inserted_at;
