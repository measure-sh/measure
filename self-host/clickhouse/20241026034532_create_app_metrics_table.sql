-- migrate:up
create table if not exists app_metrics
(
    `app_id`                   UUID not null comment 'associated app id' codec(ZSTD(3)),
    `timestamp`                DateTime64(3, 'UTC') not null comment 'interval metrics will be aggregated to' codec(DoubleDelta, ZSTD(3)),
    `app_version`              Tuple(LowCardinality(String), LowCardinality(String)) not null comment 'composite app version' codec(ZSTD(3)),
    `unique_sessions`          AggregateFunction(uniq, UUID) not null comment 'unique sessions in interval window' codec(ZSTD(3)),
    `crash_sessions`           AggregateFunction(uniq, UUID) not null comment 'crash sessions in interval window' codec(ZSTD(3)),
    `perceived_crash_sessions` AggregateFunction(uniq, UUID) not null comment 'perceived crash sessions in interval window' codec(ZSTD(3)),
    `anr_sessions`             AggregateFunction(uniq, UUID) not null comment 'anr sessions in interval window' codec(ZSTD(3)),
    `perceived_anr_sessions`   AggregateFunction(uniq, UUID) not null comment 'perceived anr sessions in interval window' codec(ZSTD(3)),
    `cold_launch_p95`          AggregateFunction(quantile(0.95), UInt32) comment 'p95 quantile of cold launch duration' codec (ZSTD(3)),
    `warm_launch_p95`          AggregateFunction(quantile(0.95), UInt32) comment 'p95 quantile of warm launch duration' codec (ZSTD(3)),
    `hot_launch_p95`           AggregateFunction(quantile(0.95), UInt32) comment 'p95 quantile of hot launch duration' codec (ZSTD(3))
)
engine = AggregatingMergeTree
order by (app_id, timestamp, app_version)
settings index_granularity = 8192
comment 'aggregated app metrics by a fixed time window';


-- migrate:down
drop table if exists app_metrics;
