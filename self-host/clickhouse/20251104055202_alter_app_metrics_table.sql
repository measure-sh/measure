-- migrate:up
alter table app_metrics
add index if not exists team_id_idx `team_id` type bloom_filter(0.025) granularity 8;


-- migrate:down
alter table app_metrics
drop index if exists team_id_idx;
