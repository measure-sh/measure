-- migrate:up
CREATE TABLE if not exists nonfatal_exception_groups
(
    `team_id` LowCardinality(UUID) COMMENT 'associated team id' CODEC(LZ4),
    `app_id` LowCardinality(UUID) COMMENT 'linked app id' CODEC(LZ4),
    `id` FixedString(32) COMMENT 'unique fingerprint of the exception which acts as the id of the group' CODEC(ZSTD(3)),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite app version' CODEC(ZSTD(3)),
    `type` String COMMENT 'type of the exception' CODEC(ZSTD(3)),
    `message` String COMMENT 'message of the exception' CODEC(ZSTD(3)),
    `method_name` String COMMENT 'method name where the exception occurred' CODEC(ZSTD(3)),
    `file_name` String COMMENT 'file name where the exception occurred' CODEC(ZSTD(3)),
    `line_number` Int32 COMMENT 'line number where the exception occurred' CODEC(ZSTD(3)),
    `handled` Bool COMMENT 'whether the exception was caught by application code' CODEC(ZSTD(3)),
    `is_custom` Bool COMMENT 'whether the exception was reported via custom capture API' CODEC(ZSTD(3)),
    `os_versions` AggregateFunction(groupUniqArray, Tuple(
        LowCardinality(String),
        LowCardinality(String))) COMMENT 'list of all unique composite os versions' CODEC(ZSTD(3)),
    `country_codes` AggregateFunction(groupUniqArray, LowCardinality(String)) COMMENT 'list of all unique country codes' CODEC(ZSTD(3)),
    `network_providers` AggregateFunction(groupUniqArray, LowCardinality(String)) COMMENT 'list of all unique network service providers' CODEC(ZSTD(3)),
    `network_types` AggregateFunction(groupUniqArray, LowCardinality(String)) COMMENT 'list of all unique network types' CODEC(ZSTD(3)),
    `network_generations` AggregateFunction(groupUniqArray, LowCardinality(String)) COMMENT 'list of all unique network generations' CODEC(ZSTD(3)),
    `device_locales` AggregateFunction(groupUniqArray, LowCardinality(String)) COMMENT 'list of all unique device locales' CODEC(ZSTD(3)),
    `device_manufacturers` AggregateFunction(groupUniqArray, LowCardinality(String)) COMMENT 'list of all unique device manufacturers' CODEC(ZSTD(3)),
    `device_names` AggregateFunction(groupUniqArray, LowCardinality(String)) COMMENT 'list of all unique device names' CODEC(ZSTD(3)),
    `device_models` AggregateFunction(groupUniqArray, LowCardinality(String)) COMMENT 'list of all unique device models' CODEC(ZSTD(3)),
    `count` AggregateFunction(sum, UInt64) COMMENT 'count of exception instances' CODEC(ZSTD(3)),
    `timestamp` SimpleAggregateFunction(max, DateTime64(3, 'UTC')) COMMENT 'timestamp of the exception event' CODEC(DoubleDelta, ZSTD(3)),
    INDEX id_bloom_idx id TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX timestamp_minmax_idx timestamp TYPE minmax GRANULARITY 1
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (team_id, app_id, app_version.1, app_version.2, id)
SETTINGS index_granularity = 8192
COMMENT 'nonfatal exception groups'


-- migrate:down
drop table if exists nonfatal_exception_groups;
