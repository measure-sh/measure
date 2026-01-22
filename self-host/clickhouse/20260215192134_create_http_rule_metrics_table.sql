-- migrate:up
CREATE TABLE http_rule_metrics
(
    `team_id` UUID,
    `app_id` UUID,
    `time_bucket` DateTime,
    `domain` String,
    `path` String,
    `status_code` UInt16,
    `method` LowCardinality(String),
    `protocol` LowCardinality(String),
    `port` UInt16,
    `app_version` Tuple(LowCardinality(String), LowCardinality(String)),
    `os_version` Tuple(LowCardinality(String), LowCardinality(String)),
    `network_provider` LowCardinality(String),
    `network_type` LowCardinality(String),
    `network_generation` LowCardinality(String),
    `device_manufacturer` LowCardinality(String),
    `device_locale` LowCardinality(String),
    `request_count` SimpleAggregateFunction(sum, UInt64), 
    `error_count` SimpleAggregateFunction(sum, UInt64),
    `status_2xx_count` SimpleAggregateFunction(sum, UInt64),
    `status_3xx_count` SimpleAggregateFunction(sum, UInt64),
    `status_4xx_count` SimpleAggregateFunction(sum, UInt64),
    `status_5xx_count` SimpleAggregateFunction(sum, UInt64),
    `latency_quantiles` AggregateFunction(quantiles(0.5, 0.9, 0.95, 0.99), Int64),
    INDEX idx_status_code status_code TYPE set(100) GRANULARITY 4,
    INDEX idx_method method TYPE set(10) GRANULARITY 4,
    INDEX idx_protocol protocol TYPE set(10) GRANULARITY 4,
    INDEX idx_port port TYPE set(100) GRANULARITY 4,
    INDEX idx_app_version app_version TYPE set(100) GRANULARITY 4,
    INDEX idx_os_version os_version TYPE set(100) GRANULARITY 4,
    INDEX idx_network_provider network_provider TYPE set(5000) GRANULARITY 4,
    INDEX idx_network_type network_type TYPE set(10) GRANULARITY 4,
    INDEX idx_network_generation network_generation TYPE set(10) GRANULARITY 4,
    INDEX idx_device_manufacturer device_manufacturer TYPE set(3000) GRANULARITY 4,
    INDEX idx_device_locale device_locale TYPE set(5000) GRANULARITY 4
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(time_bucket)
ORDER BY (team_id, app_id, domain, path, status_code, method, time_bucket)

-- migrate:down
DROP TABLE IF EXISTS http_rule_metrics;