-- migrate:up
alter table span_metrics
add column if not exists team_id UUID CODEC(ZSTD(3)) first;


-- migrate:down
alter table span_metrics
drop column if exists team_id;
