-- migrate:up
create table if not exists app_metrics
(
    `team_id`                  LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
    `app_id`                   LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
    `timestamp`                DateTime64(3, 'UTC') comment 'interval metrics will be aggregated to' CODEC(DoubleDelta, ZSTD(3)),
    `app_version`              Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
    `unique_sessions`          AggregateFunction(uniq, UUID) comment 'unique sessions in interval window' CODEC(ZSTD(3)),
    `crash_sessions`           AggregateFunction(uniq, UUID) comment 'crash sessions in interval window' CODEC(ZSTD(3)),
    `perceived_crash_sessions` AggregateFunction(uniq, UUID) comment 'perceived crash sessions in interval window' CODEC(ZSTD(3)),
    `anr_sessions`             AggregateFunction(uniq, UUID) comment 'anr sessions in interval window' CODEC(ZSTD(3)),
    `perceived_anr_sessions`   AggregateFunction(uniq, UUID) comment 'perceived anr sessions in interval window' CODEC(ZSTD(3)),
    `cold_launch_p95`          AggregateFunction(quantile(0.95), UInt32) comment 'p95 quantile of cold launch duration' CODEC(ZSTD(3)),
    `warm_launch_p95`          AggregateFunction(quantile(0.95), UInt32) comment 'p95 quantile of warm launch duration' CODEC(ZSTD(3)),
    `hot_launch_p95`           AggregateFunction(quantile(0.95), UInt32) comment 'p95 quantile of hot launch duration' CODEC(ZSTD(3)),
    index app_version_name_idx app_version.1 type set(1000) granularity 2,
    index app_version_code_idx app_version.2 type set(1000) granularity 2
)
engine = AggregatingMergeTree
partition by toYYYYMM(timestamp)
primary key (team_id, app_id, timestamp)
order by (team_id, app_id, timestamp, app_version)
settings index_granularity = 8192
comment 'aggregated app metrics by a fixed time window';

-- migrate:down
drop table if exists app_metrics;
