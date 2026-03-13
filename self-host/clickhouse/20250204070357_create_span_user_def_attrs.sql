-- migrate:up
create table if not exists span_user_def_attrs
(
    `team_id`     LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
    `app_id`      LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
    `span_id`     FixedString(16) comment 'id of the span' CODEC(LZ4),
    `session_id`  UUID comment 'id of the session' CODEC(LZ4),
    `app_version` Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
    `os_version`  Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
    `key`         LowCardinality(String) comment 'key of the user defined attribute' CODEC(ZSTD(3)),
    `type`        Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4) comment 'type of the user defined attribute' CODEC(ZSTD(3)),
    `value`       String comment 'value of the user defined attribute' CODEC(ZSTD(3)),
    `timestamp`   DateTime64(3, 'UTC') comment 'start time of the span',
    index timestamp_minmax_idx timestamp type minmax granularity 2,
    index os_version_bloom_idx toString(os_version) type bloom_filter(0.05) granularity 4,
    index os_version_set_idx os_version type set(1000) granularity 2,
    index key_bloom_idx key type bloom_filter(0.05) granularity 1,
    index key_set_idx key type set(5000) granularity 2,
    index session_bloom_idx session_id type bloom_filter(0.05) granularity 2
)
engine = ReplacingMergeTree(timestamp)
partition by toYYYYMM(timestamp)
primary key (team_id, app_id, app_version.1, app_version.2)
order by (team_id, app_id, app_version.1, app_version.2, os_version.1, os_version.2, type, key, span_id, value)
settings index_granularity = 8192
comment 'derived span user defined attributes';


-- migrate:down
drop table if exists span_user_def_attrs;
