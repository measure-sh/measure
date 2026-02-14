-- migrate:up
CREATE TABLE http (
    `team_id` String,
    `app_id` String,
    `origin` LowCardinality(String),
    `path` String,
    `status_code` UInt16,
    `method` LowCardinality(String),
    `bucket` DateTime CODEC(DoubleDelta, ZSTD(3)),
    -- Aggregated metrics
    `request_count` AggregateFunction(count),
    `duration_quantiles` AggregateFunction(quantiles(0.5, 0.9, 0.95, 0.99), Int64),
    -- Attributes
    `app_version` Tuple(LowCardinality(String), LowCardinality(String)),
    `os_version` Tuple(LowCardinality(String), LowCardinality(String)),
    `network_provider` LowCardinality(String),
    `network_type` LowCardinality(String),
    `network_generation` LowCardinality(String),
    `device_locale` LowCardinality(String),
    `device_manufacturer` LowCardinality(String),
    `device_name` LowCardinality(String),
    `device_model` LowCardinality(String),
    -- Skip indexes for path filtering
    INDEX idx_path `path` TYPE tokenbf_v1(8192, 3, 0) GRANULARITY 4
) ENGINE = AggregatingMergeTree() PARTITION BY toYYYYMM(bucket)
ORDER BY
    (
        team_id,
        app_id,
        origin,
        path,
        status_code,
        method,
        bucket
    );

-- migrate:down
DROP TABLE IF EXISTS http;