-- migrate:up
create table if not exists span_metrics
(
    `app_id`                              UUID not null comment 'associated app id' codec(ZSTD(3)),
    `span_name`                           LowCardinality(FixedString(128)) not null comment 'name of the span' codec(ZSTD(3)),
    `span_id`                             FixedString(16) not null comment 'id of the span' codec(ZSTD(3)),
    `status`                              UInt8 not null comment 'status of the span 0 (Unset), 1 (Ok) or 2 (Error)' codec(ZSTD(3)),
    `timestamp`                           DateTime64(3, 'UTC') not null comment 'interval metrics will be aggregated to' codec(DoubleDelta, ZSTD(3)),
    `app_version`                         Tuple(LowCardinality(String), LowCardinality(String)) not null comment 'composite app version' codec(ZSTD(3)),
    `os_version`                          Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' codec(ZSTD(3)),
    `country_code`                        LowCardinality(String) comment 'country code' codec(ZSTD(3)),
    `network_provider`                    LowCardinality(String) comment 'network provider' codec(ZSTD(3)),
    `network_type`                        LowCardinality(String) comment 'network type' codec(ZSTD(3)),
    `network_generation`                  LowCardinality(String) comment 'network generation' codec(ZSTD(3)),
    `device_locale`                       LowCardinality(String) comment 'device locale' codec(ZSTD(3)),
    `device_manufacturer`                 LowCardinality(String) comment 'device manufacturer' codec(ZSTD(3)),
    `device_name`                         LowCardinality(String) comment 'device name' codec(ZSTD(3)),
    `device_low_power_mode`               Bool not null comment 'true if device is in power saving mode' codec(ZSTD(3)),
    `device_thermal_throttling_enabled`   Bool not null comment 'true if device is has thermal throttling enabled' codec(ZSTD(3)),
    `p50`                                 AggregateFunction(quantile(0.50), Int64) comment 'p50 quantile of span duration' codec (ZSTD(3)),
    `p90`                                 AggregateFunction(quantile(0.90), Int64) comment 'p90 quantile of span duration' codec (ZSTD(3)),
    `p95`                                 AggregateFunction(quantile(0.95), Int64) comment 'p95 quantile of span duration' codec (ZSTD(3)),
    `p99`                                 AggregateFunction(quantile(0.50), Int64) comment 'p99 quantile of span duration' codec (ZSTD(3)),
)
engine = AggregatingMergeTree
order by (app_id, span_name, span_id, timestamp, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name)
settings index_granularity = 8192
comment 'aggregated span metrics by a fixed time window';


-- migrate:down
drop table if exists span_metrics;
