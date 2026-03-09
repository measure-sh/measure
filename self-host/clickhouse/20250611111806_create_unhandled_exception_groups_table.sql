-- migrate:up
create table if not exists unhandled_exception_groups
(
    `team_id` LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
    `app_id` LowCardinality(UUID) comment 'linked app id' CODEC(LZ4),
    `id` FixedString(32) comment 'unique fingerprint of the unhandled exception which acts as the id of the group' CODEC(ZSTD(3)),
    `app_version` Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
    `type` String comment 'type of the exception' CODEC(ZSTD(3)),
    `message` String comment 'message of the exception' CODEC(ZSTD(3)),
    `method_name` String comment 'method name where the exception occurred' CODEC(ZSTD(3)),
    `file_name` String comment 'file name where the exception occurred' CODEC(ZSTD(3)),
    `line_number` Int32 comment 'line number where the exception occurred' CODEC(ZSTD(3)),
    `os_versions` AggregateFunction(groupUniqArray, Tuple(LowCardinality(String), LowCardinality(String))) comment 'list of all unique composite os versions' CODEC(ZSTD(3)),
    `country_codes` AggregateFunction(groupUniqArray, LowCardinality(String)) comment 'list of all unique country codes' CODEC(ZSTD(3)),
    `network_providers` AggregateFunction(groupUniqArray, LowCardinality(String)) comment 'list of all unique network service providers' CODEC(ZSTD(3)),
    `network_types` AggregateFunction(groupUniqArray, LowCardinality(String)) comment 'list of all unique network types' CODEC(ZSTD(3)),
    `network_generations` AggregateFunction(groupUniqArray, LowCardinality(String)) comment 'list of all unique network generations' CODEC(ZSTD(3)),
    `device_locales` AggregateFunction(groupUniqArray, LowCardinality(String)) comment 'list of all unique device locales' CODEC(ZSTD(3)),
    `device_manufacturers` AggregateFunction(groupUniqArray, LowCardinality(String)) comment 'list of all unique device manufacturers' CODEC(ZSTD(3)),
    `device_names` AggregateFunction(groupUniqArray, LowCardinality(String)) comment 'list of all unique device names' CODEC(ZSTD(3)),
    `device_models` AggregateFunction(groupUniqArray, LowCardinality(String)) comment 'list of all unique device models' CODEC(ZSTD(3)),
    `count` AggregateFunction(sum, UInt64) comment 'count of unhandled exception instances' CODEC(ZSTD(3)),
    `timestamp` SimpleAggregateFunction(max, DateTime64(3, 'UTC')) comment 'timestamp of the exception event' CODEC(DoubleDelta, ZSTD(3)),
    index id_bloom_idx id type bloom_filter(0.01) granularity 1,
    index timestamp_minmax_idx timestamp type minmax granularity 1
)
engine = AggregatingMergeTree
partition by toYYYYMM(timestamp)
order by (team_id, app_id, app_version.1, app_version.2, id)
settings index_granularity = 8192
comment 'unhandled exception groups';

-- migrate:down
drop table if exists unhandled_exception_groups;
