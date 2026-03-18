-- migrate:up
create table if not exists http_metrics
(
    `team_id` LowCardinality(UUID) comment 'team id' CODEC(ZSTD(3)),
    `app_id` LowCardinality(UUID) comment 'app id' CODEC(ZSTD(3)),
    `timestamp` DateTime64(3, 'UTC') comment 'truncated event timestamp (15m bucket)' CODEC(DoubleDelta, ZSTD(3)),
    `domain` String comment 'request domain' CODEC(ZSTD(3)),
    `path` String comment 'request path' CODEC(ZSTD(3)),
    `protocols` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique request protocols',
    `ports` SimpleAggregateFunction(groupUniqArrayArray, Array(UInt16)) comment 'list of all unique request ports',
    `methods` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique http methods',
    `status_codes` SimpleAggregateFunction(groupUniqArrayArray, Array(UInt16)) comment 'list of all unique http status codes',
    `app_versions` SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of all unique app versions (version, build)',
    `os_versions` SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(String, String))) comment 'list of all unique os versions (name, version)',
    `device_manufacturers` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique device manufacturers',
    `device_names` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique device names',
    `network_providers` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network providers',
    `network_types` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network types',
    `network_generations` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique network generations',
    `device_locales` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique device locales',
    `inet.country_code` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique country codes',
    `request_count` SimpleAggregateFunction(sum, UInt64) comment 'total number of requests',
    `count_2xx` SimpleAggregateFunction(sum, UInt64) comment 'count of 2xx responses',
    `count_3xx` SimpleAggregateFunction(sum, UInt64) comment 'count of 3xx responses',
    `count_4xx` SimpleAggregateFunction(sum, UInt64) comment 'count of 4xx responses',
    `count_5xx` SimpleAggregateFunction(sum, UInt64) comment 'count of 5xx responses',
    `latency_percentiles` AggregateFunction(quantiles(0.5, 0.75, 0.90, 0.95, 0.99), Int64) comment 'latency percentile states in milliseconds',
    `session_elapsed_counts` SimpleAggregateFunction(sumMap, Tuple(Array(UInt32), Array(UInt64))) comment 'map of session elapsed second bucket to request count',
    `session_count` AggregateFunction(uniqCombined64, UUID) comment 'approximate distinct session count',
    INDEX idx_timestamp `timestamp` TYPE minmax GRANULARITY 1
)
engine = AggregatingMergeTree
partition by toYYYYMM(`timestamp`)
order by (`team_id`,`app_id`,`domain`,`path`,`timestamp`)
comment 'pre-aggregated metrics for url_patterns bucketed by 15-minute intervals';

-- migrate:down
drop table if exists http_metrics;
