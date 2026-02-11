-- migrate:up
CREATE TABLE http (
    `team_id` String,
    `app_id` String,
    `origin` LowCardinality(String),
    `method` LowCardinality(String),
    `path` String,
    `event_id` UUID,
    `bucket` DateTime CODEC(DoubleDelta, ZSTD(3)),
    `status_code` UInt16,
    `duration` UInt64,
    `attribute.installation_id` String,
    `attribute.app_unique_id` LowCardinality(String),
    `attribute.platform` LowCardinality(String),
    `attribute.measure_sdk_version` LowCardinality(String),
    `attribute.thread_name` LowCardinality(String),
    `attribute.user_id` String,
    `attribute.device_name` LowCardinality(String),
    `attribute.device_model` LowCardinality(String),
    `attribute.device_manufacturer` LowCardinality(String),
    `attribute.device_type` LowCardinality(String),
    `attribute.device_is_foldable` Bool,
    `attribute.device_is_physical` Bool,
    `attribute.device_density_dpi` UInt16,
    `attribute.device_width_px` UInt16,
    `attribute.device_height_px` UInt16,
    `attribute.device_density` Float32,
    `attribute.device_locale` LowCardinality(String),
    `attribute.device_low_power_mode` Bool,
    `attribute.device_thermal_throttling_enabled` Bool,
    `attribute.device_cpu_arch` LowCardinality(String),
    `attribute.os_name` LowCardinality(String),
    `attribute.os_version` LowCardinality(String),
    `attribute.os_page_size` UInt8,
    `attribute.network_type` LowCardinality(String),
    `attribute.network_generation` LowCardinality(String),
    `attribute.network_provider` LowCardinality(String),
    `attribute.app_version` LowCardinality(String),
    `attribute.app_build` LowCardinality(String),
    INDEX idx_path `path` TYPE tokenbf_v1(8192, 3, 0) GRANULARITY 4
) ENGINE = MergeTree() PARTITION BY toYYYYMM(bucket)
ORDER BY
    (
        `team_id`,
        `app_id`,
        `origin`,
        `method`,
        `status_code`,
        `attribute.network_type`,
        `attribute.network_generation`,
        `attribute.network_provider`,
        `attribute.app_version`,
        `attribute.app_build`,
        `bucket`,
        `event_id`
    );

-- migrate:down
DROP TABLE IF EXISTS http;
