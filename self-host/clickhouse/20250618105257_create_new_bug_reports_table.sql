-- migrate:up

create table bug_reports_new
(
    `team_id`                             LowCardinality(UUID) CODEC(LZ4),
    `event_id`                            UUID comment 'bug report event id' CODEC(LZ4),
    `app_id`                              LowCardinality(UUID) comment 'unique id of the app' CODEC(LZ4),
    `session_id`                          UUID comment 'session id' CODEC(LZ4),
    `timestamp`                           DateTime64(3, 'UTC') comment 'timestamp of the bug report' CODEC(DoubleDelta, ZSTD(3)),
    `updated_at`                          DateTime64(3, 'UTC') comment 'timestamp when record was last updated' CODEC(DoubleDelta, ZSTD(3)),
    `status`                              UInt8 comment 'status of the bug report 0 (Closed) or 1 (Open)' CODEC(ZSTD(3)),
    `description`                         String comment 'description of the bug report' CODEC(ZSTD(3)),
    `app_version`                         Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite app version' CODEC(ZSTD(3)),
    `os_version`                          Tuple(LowCardinality(String), LowCardinality(String)) comment 'composite os version' CODEC(ZSTD(3)),
    `country_code`                        LowCardinality(String) comment 'country code' CODEC(ZSTD(3)),
    `network_provider`                    LowCardinality(String) comment 'name of the network service provider' CODEC(ZSTD(3)),
    `network_type`                        LowCardinality(String) comment 'wifi, cellular, vpn and so on' CODEC(ZSTD(3)),
    `network_generation`                  LowCardinality(String) comment '2g, 3g, 4g and so on' CODEC(ZSTD(3)),
    `device_locale`                       LowCardinality(String) comment 'rfc 5646 locale string' CODEC(ZSTD(3)),
    `device_manufacturer`                 LowCardinality(String) comment 'manufacturer of the device' CODEC(ZSTD(3)),
    `device_name`                         LowCardinality(String) comment 'name of the device' CODEC(ZSTD(3)),
    `device_model`                        LowCardinality(String) comment 'model of the device' CODEC(ZSTD(3)),
    `user_id`                             LowCardinality(String) comment 'attributed user id' CODEC(ZSTD(3)),
    `device_low_power_mode`               Bool comment 'true if low power mode is enabled',
    `device_thermal_throttling_enabled`   Bool comment 'true if thermal throttling is enabled',
    `user_defined_attribute`              Map(LowCardinality(String), Tuple(Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4), String)) comment 'user defined attributes' CODEC(ZSTD(3)),
    `attachments`                         String comment 'attachment metadata',
    index event_id_bloom_idx event_id type bloom_filter(0.01) granularity 2,
    index session_id_bloom_idx session_id type bloom_filter(0.01) granularity 2,
    index status_set_idx status type set(100) granularity 2,
    index os_version_set_idx os_version type set(100) granularity 2,
    index country_code_set_idx country_code type set(100) granularity 2,
    index network_provider_set_idx network_provider type set(100) granularity 2,
    index network_type_set_idx network_type type set(100) granularity 2,
    index network_generation_set_idx network_generation type set(100) granularity 2,
    index device_locale_set_idx device_locale type set(100) granularity 2,
    index device_manufacturer_set_idx device_manufacturer type set(100) granularity 2,
    index device_name_set_idx device_name type set(100) granularity 2,
    index user_id_bloom_idx user_id type bloom_filter(0.01) granularity 2,
    index user_defined_attribute_key_bloom_idx mapKeys(user_defined_attribute) type bloom_filter(0.01) granularity 8
)
ENGINE = ReplacingMergeTree
partition by toYYYYMM(timestamp)
order by (team_id, app_id, app_version.1, app_version.2, timestamp, event_id)
settings index_granularity = 1024, enable_block_number_column = 1, enable_block_offset_column = 1
comment 'derived bug reports';

-- migrate:down

drop table if exists bug_reports_new;
