-- migrate:up
create table if not exists bug_reports
(
    `event_id`                            UUID not null comment 'bug report event id' codec(ZSTD(3)),
    `app_id`                              UUID not null comment 'unique id of the app' codec(ZSTD(3)),
    `session_id`                          UUID not null comment 'session id' codec(ZSTD(3)),
    `timestamp`                           DateTime64(9, 'UTC') not null comment 'timestamp of the bug report' codec(DoubleDelta, ZSTD(3)),
    `status`                              UInt8 not null comment 'status of the bug report 0 (Closed) or 1 (Open)' codec(ZSTD(3)),
    `description`                         String comment 'description of the bug report' codec(ZSTD(3)),
    `app_version`                         Tuple(LowCardinality(String), LowCardinality(String)) not null comment 'composite app version' codec(ZSTD(3)),
    `os_version`                          Tuple(LowCardinality(String), LowCardinality(String)) not null comment 'composite os version' codec(ZSTD(3)),
    `country_code`                        LowCardinality(String) comment 'country code' codec(ZSTD(3)),
    `network_provider`                    LowCardinality(String) comment 'name of the network service provider' codec(ZSTD(3)),
    `network_type`                        LowCardinality(String) comment 'wifi, cellular, vpn and so on' codec(ZSTD(3)),
    `network_generation`                  LowCardinality(String) comment '2g, 3g, 4g and so on' codec(ZSTD(3)),
    `device_locale`                       LowCardinality(String) comment 'rfc 5646 locale string' codec(ZSTD(3)),
    `device_manufacturer`                 LowCardinality(String) comment 'manufacturer of the device' codec(ZSTD(3)),
    `device_name`                         LowCardinality(String) comment 'name of the device' codec(ZSTD(3)),
    `device_model`                        LowCardinality(String) comment 'model of the device' codec(ZSTD(3)),
    `user_id`                             LowCardinality(String) comment 'attributed user id' codec(ZSTD(3)),
    `device_low_power_mode`               Boolean comment 'true if low power mode is enabled',
    `device_thermal_throttling_enabled`   Boolean comment 'true if thermal throttling is enabled',
    `user_defined_attribute`              Map(LowCardinality(String), Tuple(Enum('string' = 1, 'int64', 'float64', 'bool'), String)) comment 'user defined attributes' codec(ZSTD(3)),
    `attachments`                         String comment 'attachment metadata'
)
engine = ReplacingMergeTree
partition by toYYYYMM(timestamp)
order by (app_id, os_version, app_version, session_id, timestamp, event_id)
settings index_granularity = 8192
comment 'aggregated app bug reports';


-- migrate:down
drop table if exists bug_reports;
