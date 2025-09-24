-- migrate:up

create table bug_reports_new
(
    `event_id`                            UUID NOT NULL COMMENT 'bug report event id' CODEC(ZSTD(3)),
    `app_id`                              UUID NOT NULL COMMENT 'unique id of the app' CODEC(ZSTD(3)),
    `session_id`                          UUID NOT NULL COMMENT 'session id' CODEC(ZSTD(3)),
    `timestamp`                           DateTime64(9, 'UTC') NOT NULL COMMENT 'timestamp of the bug report' CODEC(DoubleDelta, ZSTD(3)),
    `updated_at`                          DateTime64(9, 'UTC') NOT NULL COMMENT 'timestamp when record was last updated' CODEC(DoubleDelta, ZSTD(3)),
    `status`                              UInt8 NOT NULL COMMENT 'status of the bug report 0 (Closed) or 1 (Open)' CODEC(ZSTD(3)),
    `description`                         String COMMENT 'description of the bug report' CODEC(ZSTD(3)),
    `app_version`                         Tuple(LowCardinality(String), LowCardinality(String)) NOT NULL COMMENT 'composite app version' CODEC(ZSTD(3)),
    `os_version`                          Tuple(LowCardinality(String), LowCardinality(String)) NOT NULL COMMENT 'composite os version' CODEC(ZSTD(3)),
    `country_code`                        LowCardinality(String) COMMENT 'country code' CODEC(ZSTD(3)),
    `network_provider`                    LowCardinality(String) COMMENT 'name of the network service provider' CODEC(ZSTD(3)),
    `network_type`                        LowCardinality(String) COMMENT 'wifi, cellular, vpn and so on' CODEC(ZSTD(3)),
    `network_generation`                  LowCardinality(String) COMMENT '2g, 3g, 4g and so on' CODEC(ZSTD(3)),
    `device_locale`                       LowCardinality(String) COMMENT 'rfc 5646 locale string' CODEC(ZSTD(3)),
    `device_manufacturer`                 LowCardinality(String) COMMENT 'manufacturer of the device' CODEC(ZSTD(3)),
    `device_name`                         LowCardinality(String) COMMENT 'name of the device' CODEC(ZSTD(3)),
    `device_model`                        LowCardinality(String) COMMENT 'model of the device' CODEC(ZSTD(3)),
    `user_id`                             LowCardinality(String) COMMENT 'attributed user id' CODEC(ZSTD(3)),
    `device_low_power_mode`               Boolean COMMENT 'true if low power mode is enabled',
    `device_thermal_throttling_enabled`   Boolean COMMENT 'true if thermal throttling is enabled',
    `user_defined_attribute`              Map(LowCardinality(String), Tuple(Enum('string' = 1, 'int64', 'float64', 'bool'), String)) COMMENT 'user defined attributes' CODEC(ZSTD(3)),
    `attachments`                         String COMMENT 'attachment metadata'
)
ENGINE = ReplacingMergeTree(updated_at)
partition by toYYYYMM(timestamp)
order by (app_id, os_version, app_version, session_id, timestamp, event_id)
SETTINGS index_granularity = 8192
COMMENT 'aggregated app bug reports with versioning';

-- migrate:down

drop table if exists bug_reports_new;