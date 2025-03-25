-- migrate:up
create or replace table user_def_attrs
(
    `app_id`       UUID not null comment 'associated app id' codec(LZ4),
    `event_id`     UUID not null comment 'id of the event' codec(LZ4),
    `session_id`   UUID not null comment 'id of the session' codec(LZ4),
    `end_of_month` DateTime not null comment 'last day of the month' codec(DoubleDelta, ZSTD(3)),
    `app_version`  Tuple(LowCardinality(String), LowCardinality(String)) not null comment 'composite app version' codec(ZSTD(3)),
    `os_version`   Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' codec (ZSTD(3)),
    `exception`    Bool comment 'true if source is exception event' codec (ZSTD(3)),
    `anr`          Bool comment 'true if source is anr event' codec (ZSTD(3)),
    `key`          LowCardinality(String) comment 'key of the user defined attribute' codec (ZSTD(3)),
    `type`         Enum('string' = 1, 'int64', 'float64', 'bool') comment 'type of the user defined attribute' codec (ZSTD(3)),
    `value`        String comment 'value of the user defined attribute' codec (ZSTD(3)),
    `ver`          DateTime64(9) not null comment 'high precision timestamp version for ReplacingMergeTree',
    index end_of_month_minmax_idx end_of_month type minmax granularity 2,
    index exception_bloom_idx exception type bloom_filter granularity 2,
    index anr_bloom_idx anr type bloom_filter granularity 2,
    index key_bloom_idx key type bloom_filter(0.05) granularity 1,
    index key_set_idx key type set(1000) granularity 2,
    index session_bloom_idx session_id type bloom_filter granularity 2
)
engine = ReplacingMergeTree(ver)
partition by toYYYYMM(end_of_month)
order by (app_id, end_of_month, app_version, os_version, exception, anr,
            key, type, value, event_id, session_id)
settings index_granularity = 8192
comment 'derived user defined attributes';


-- migrate:down
create or replace table user_def_attrs
(
    `app_id`       UUID not null comment 'associated app id' codec(LZ4),
    `event_id`     UUID not null comment 'id of the event' codec(LZ4),
    `session_id`   UUID not null comment 'id of the session' codec(LZ4),
    `end_of_month` DateTime not null comment 'last day of the month' codec(DoubleDelta, ZSTD(3)),
    `app_version`  Tuple(LowCardinality(String), LowCardinality(String)) not null comment 'composite app version' codec(ZSTD(3)),
    `os_version`   Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' codec (ZSTD(3)),
    `exception`    Bool comment 'true if source is exception event' codec (ZSTD(3)),
    `anr`          Bool comment 'true if source is anr event' codec (ZSTD(3)),
    `key`          LowCardinality(String) comment 'key of the user defined attribute' codec (ZSTD(3)),
    `type`         Enum('string' = 1, 'int64', 'float64', 'bool') comment 'type of the user defined attribute' codec (ZSTD(3)),
    `value`        String comment 'value of the user defined attribute' codec (ZSTD(3)),
    index end_of_month_minmax_idx end_of_month type minmax granularity 2,
    index exception_bloom_idx exception type bloom_filter granularity 2,
    index anr_bloom_idx anr type bloom_filter granularity 2,
    index key_bloom_idx key type bloom_filter(0.05) granularity 1,
    index key_set_idx key type set(1000) granularity 2,
    index session_bloom_idx session_id type bloom_filter granularity 2
)
engine = ReplacingMergeTree
partition by toYYYYMM(end_of_month)
order by (app_id, end_of_month, app_version, os_version, exception, anr,
            key, type, value, event_id, session_id)
settings index_granularity = 8192
comment 'derived user defined attributes';
