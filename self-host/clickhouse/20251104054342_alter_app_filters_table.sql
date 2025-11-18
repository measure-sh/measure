-- migrate:up
alter table app_filters
add column if not exists team_id UUID CODEC(ZSTD(3)) first;

-- migrate:down
alter table app_filters
drop column if exists team_id;
