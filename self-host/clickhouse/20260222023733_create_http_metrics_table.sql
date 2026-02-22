-- migrate:up
create table http_metrics
(
    `team_id` UUID comment 'team id' codec(ZSTD(3)),
    `app_id` UUID comment 'app id' codec(ZSTD(3)),
    `timestamp` DateTime64(3) comment 'truncated event timestamp (15m bucket)' codec(DoubleDelta, ZSTD(3)),
    `protocol` LowCardinality(String) comment 'request protocol' codec(ZSTD(3)),
    `port` UInt16 comment 'request port' codec(ZSTD(3)),
    `domain` String comment 'request domain' codec(ZSTD(3)),
    `path` String comment 'request path' codec(ZSTD(3)),
    `method` LowCardinality(String) comment 'http method' codec(ZSTD(3)),
    `status_code` UInt16 comment 'raw http status code' codec(ZSTD(3)),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) comment 'composite app version (version, build)' codec(ZSTD(3)),
    `os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) comment 'composite os version (name, version)' codec(ZSTD(3)),
    `device_manufacturer` LowCardinality(String) comment 'device manufacturer' codec(ZSTD(3)),
    `device_name` LowCardinality(String) comment 'device name' codec(ZSTD(3)),
    `network_providers` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network providers',
    `network_types` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network types',
    `network_generations` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network generations',
    `device_locales` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique device locales',
    `request_count` SimpleAggregateFunction(sum, UInt64) comment 'total number of requests',
    `count_2xx` SimpleAggregateFunction(sum, UInt64) comment 'count of 2xx responses',
    `count_3xx` SimpleAggregateFunction(sum, UInt64) comment 'count of 3xx responses',
    `count_4xx` SimpleAggregateFunction(sum, UInt64) comment 'count of 4xx responses',
    `count_5xx` SimpleAggregateFunction(sum, UInt64) comment 'count of 5xx responses',
    `latency_percentiles` AggregateFunction(quantiles(0.5, 0.75, 0.90, 0.95, 0.99, 1.0), Int64) comment 'latency percentile states in milliseconds',
    index idx_status_code `status_code` type set(0) granularity 1,
    index idx_method `method` type set(0) granularity 1
)
engine = AggregatingMergeTree
partition by toYYYYMM(`timestamp`)
order by (`team_id`,`app_id`,`domain`,`path`,`timestamp`);

-- migrate:down
drop table if exists http_metrics;