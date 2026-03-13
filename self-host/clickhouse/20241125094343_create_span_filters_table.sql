-- migrate:up
create table if not exists span_filters
(
    `team_id`             LowCardinality(UUID) CODEC(LZ4),
    `app_id`              LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
    `end_of_month`        DateTime comment 'last day of the month' CODEC(DoubleDelta, ZSTD(3)),
    `app_version`         Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
    `os_version`          Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
    `country_code`        LowCardinality(String) comment 'country code' CODEC(ZSTD(3)),
    `network_provider`    LowCardinality(String) comment 'network provider' CODEC(ZSTD(3)),
    `network_type`        LowCardinality(String) comment 'network type' CODEC(ZSTD(3)),
    `network_generation`  LowCardinality(String) comment 'network generation' CODEC(ZSTD(3)),
    `device_locale`       LowCardinality(String) comment 'device locale' CODEC(ZSTD(3)),
    `device_manufacturer` LowCardinality(String) comment 'device manufacturer' CODEC(ZSTD(3)),
    `device_name`         LowCardinality(String) comment 'device name' CODEC(ZSTD(3))
)
engine = ReplacingMergeTree
primary key (team_id, app_id, end_of_month)
order by (team_id, app_id, end_of_month, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name)
settings index_granularity = 8192
comment 'derived span filters';

-- migrate:down
drop table if exists span_filters;
