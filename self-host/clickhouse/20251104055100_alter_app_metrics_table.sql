-- migrate:up
alter table app_metrics
add column if not exists team_id UUID CODEC(ZSTD(3)) first;


-- migrate:down
alter table app_metrics
drop column if exists team_id;
