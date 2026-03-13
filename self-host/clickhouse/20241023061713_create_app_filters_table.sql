-- migrate:up
create table if not exists app_filters
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
    `device_name`         LowCardinality(String) comment 'device name' CODEC(ZSTD(3)),
    `exception`           Bool comment 'true if source is exception event' CODEC(ZSTD(3)),
    `anr`                 Bool comment 'true if source is anr event' CODEC(ZSTD(3))
)
engine = ReplacingMergeTree
partition by toYYYYMM(end_of_month)
primary key (team_id, app_id, end_of_month)
order by (team_id, app_id, end_of_month, exception, anr, network_type, network_generation, os_version, app_version, country_code, device_manufacturer, device_locale, network_provider, device_name)
settings index_granularity = 8192
comment 'derived app filters';

-- migrate:down
drop table if exists app_filters;
