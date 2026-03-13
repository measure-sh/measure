-- migrate:up
create table if not exists span_metrics
(
    `team_id`                             LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
    `app_id`                              LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
    `span_name`                           LowCardinality(String) comment 'name of the span' CODEC(ZSTD(3)),
    `span_id`                             FixedString(16) comment 'id of the span' CODEC(ZSTD(3)),
    `status`                              UInt8 comment 'status of the span 0 (Unset), 1 (Ok) or 2 (Error)' CODEC(ZSTD(3)),
    `timestamp`                           DateTime64(3, 'UTC') comment 'interval metrics will be aggregated to' CODEC(DoubleDelta, ZSTD(3)),
    `app_version`                         Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
    `os_version`                          Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
    `country_code`                        LowCardinality(String) comment 'country code' CODEC(ZSTD(3)),
    `network_provider`                    LowCardinality(String) comment 'network provider' CODEC(ZSTD(3)),
    `network_type`                        LowCardinality(String) comment 'network type' CODEC(ZSTD(3)),
    `network_generation`                  LowCardinality(String) comment 'network generation' CODEC(ZSTD(3)),
    `device_locale`                       LowCardinality(String) comment 'device locale' CODEC(ZSTD(3)),
    `device_manufacturer`                 LowCardinality(String) comment 'device manufacturer' CODEC(ZSTD(3)),
    `device_name`                         LowCardinality(String) comment 'device name' CODEC(ZSTD(3)),
    `device_low_power_mode`               Bool comment 'true if device is in power saving mode' CODEC(ZSTD(3)),
    `device_thermal_throttling_enabled`   Bool comment 'true if device is has thermal throttling enabled' CODEC(ZSTD(3)),
    `p50`                                 AggregateFunction(quantile(0.5), Int64) comment 'p50 quantile of span duration' CODEC(ZSTD(3)),
    `p90`                                 AggregateFunction(quantile(0.9), Int64) comment 'p90 quantile of span duration' CODEC(ZSTD(3)),
    `p95`                                 AggregateFunction(quantile(0.95), Int64) comment 'p95 quantile of span duration' CODEC(ZSTD(3)),
    `p99`                                 AggregateFunction(quantile(0.5), Int64) comment 'p99 quantile of span duration' CODEC(ZSTD(3)),
    index status_set_idx status type set(100) granularity 2,
    index os_version_set_idx os_version type set(1000) granularity 2,
    index country_code_set_idx country_code type set(1000) granularity 2,
    index network_provider_set_idx network_provider type set(5000) granularity 2,
    index network_type_set_idx network_type type set(100) granularity 2,
    index network_generation_set_idx network_generation type set(100) granularity 2,
    index device_locale_set_idx device_locale type set(5000) granularity 2,
    index device_manufacturer_set_idx device_manufacturer type set(5000) granularity 2,
    index device_name_set_idx device_name type set(5000) granularity 2
)
engine = AggregatingMergeTree
order by (team_id, app_id, app_version.1, app_version.2, span_name, timestamp, span_id)
settings index_granularity = 8192
comment 'aggregated span metrics by a fixed time window';

-- migrate:down
drop table if exists span_metrics;
