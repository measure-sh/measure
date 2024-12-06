-- migrate:up
create table if not exists span_filters
(
    `app_id`              UUID not null comment 'associated app id' codec(LZ4),
    `end_of_month`        DateTime not null comment 'last day of the month' codec(DoubleDelta, ZSTD(3)),
    `app_version`         Tuple(LowCardinality(String), LowCardinality(String)) not null comment 'composite app version' codec(ZSTD(3)),
    `os_version`          Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' codec(ZSTD(3)),
    `country_code`        LowCardinality(String) comment 'country code' codec(ZSTD(3)),
    `network_provider`    LowCardinality(String) comment 'network provider' codec(ZSTD(3)),
    `network_type`        LowCardinality(String) comment 'network type' codec(ZSTD(3)),
    `network_generation`  LowCardinality(String) comment 'network generation' codec(ZSTD(3)),
    `device_locale`       LowCardinality(String) comment 'device locale' codec(ZSTD(3)),
    `device_manufacturer` LowCardinality(String) comment 'device manufacturer' codec(ZSTD(3)),
    `device_name`         LowCardinality(String) comment 'device name' codec(ZSTD(3)),
)
engine = ReplacingMergeTree
order by (app_id, end_of_month, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name)
settings index_granularity = 8192
comment 'derived span filters';


-- migrate:down
drop table if exists span_filters;

