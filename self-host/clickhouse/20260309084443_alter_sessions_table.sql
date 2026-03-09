-- migrate:up
alter table sessions
    drop index if exists user_id_bloom_idx,
    drop index if exists team_id_idx,
    drop column if exists start_time,
    drop column if exists end_time,
    drop column if exists user_id;

-- migrate:down
alter table sessions
    add column if not exists user_id LowCardinality(String) comment 'attributed user id' CODEC(ZSTD(3)),
    add column if not exists start_time SimpleAggregateFunction(min, DateTime64(9, 'UTC')) CODEC(DoubleDelta, ZSTD(3)) after last_event_timestamp,
    add column if not exists end_time SimpleAggregateFunction(max, DateTime64(9, 'UTC')) CODEC(DoubleDelta, ZSTD(3)) after start_time,
    add index if not exists team_id_idx `team_id` type bloom_filter(0.025) granularity 8,
    add index if not exists user_id_bloom_idx `user_id` type bloom_filter granularity 2;
