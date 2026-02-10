-- migrate:up
CREATE TABLE http_metrics (
    `team_id` UInt64,
    `app_id` String,
    `protocol` LowCardinality(String),
    `host` LowCardinality(String),
    `method` LowCardinality(String),
    `path` String,
    `bucket` DateTime CODEC(DoubleDelta, ZSTD(1)),
    `status_code` UInt16,
    `attribute.network_type` LowCardinality(String),
    `attribute.network_generation` LowCardinality(String),
    `attribute.network_provider` LowCardinality(String),
    `attribute.app_version` LowCardinality(String),
    `attribute.app_build` LowCardinality(String),
    `request_count` SimpleAggregateFunction(sum, UInt64),
    `latency_quantile` AggregateFunction(quantiles(0.50, 0.90, 0.95, 0.99), Float32),
    INDEX idx_path `path` TYPE tokenbf_v1(8192, 3, 0) GRANULARITY 4
) ENGINE = AggregatingMergeTree() PARTITION BY toYYYYMM(bucket)
ORDER BY
    (
        `team_id`,
        `app_id`,
        `protocol`,
        `host`,
        `method`,
        `path`,
        `bucket`,
        `status_code`,
        `attribute.network_type`,
        `attribute.network_generation`,
        `attribute.network_provider`,
        `attribute.app_version`,
        `attribute.app_build`
    );

-- migrate:down
DROP TABLE IF EXISTS http_metrics;