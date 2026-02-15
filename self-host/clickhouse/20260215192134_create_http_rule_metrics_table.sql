-- migrate:up
CREATE TABLE http_rule_metrics
(
    `team_id` UUID,
    `app_id` UUID,
    `bucket` DateTime,
    `domain` String,
    `path` String,
    `status_code` UInt16,
    `method` LowCardinality(String),
    `protocol` LowCardinality(String),
    `port` UInt16,
    `app_version` AggregateFunction(anyLast, Tuple(String, String)),
    `os_version` AggregateFunction(anyLast, Tuple(String, String)),
    `network_type` AggregateFunction(anyLast, String),
    `network_generation` AggregateFunction(anyLast, String),
    `device_manufacturer` AggregateFunction(anyLast, String),
    `device_model` AggregateFunction(anyLast, String),
    `request_count` AggregateFunction(count, UInt64),
    `error_count` AggregateFunction(sumIf, UInt64, UInt8),
    `server_error_count` AggregateFunction(sumIf, UInt64, UInt8),
    `failed_request_count` AggregateFunction(sumIf, UInt64, UInt8),
    `latency_p50` AggregateFunction(quantile(0.5), Int64),
    `latency_p95` AggregateFunction(quantile(0.95), Int64),
    `latency_p99` AggregateFunction(quantile(0.99), Int64),
    `status_2xx_count` AggregateFunction(sumIf, UInt64, UInt8),
    `status_3xx_count` AggregateFunction(sumIf, UInt64, UInt8),
    `status_4xx_count` AggregateFunction(sumIf, UInt64, UInt8),
    `status_5xx_count` AggregateFunction(sumIf, UInt64, UInt8),
    INDEX idx_status_code status_code TYPE set(50) GRANULARITY 4,
    INDEX idx_method method TYPE set(10) GRANULARITY 4,
    INDEX idx_protocol protocol TYPE set(5) GRANULARITY 4,
    INDEX idx_port port TYPE set(20) GRANULARITY 4,
    INDEX idx_network_type network_type TYPE set(5) GRANULARITY 4,
    INDEX idx_network_generation network_generation TYPE set(10) GRANULARITY 4,
    INDEX idx_device_manufacturer device_manufacturer TYPE set(50) GRANULARITY 4,
    INDEX idx_device_model device_model TYPE set(200) GRANULARITY 4
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(bucket)
ORDER BY (team_id, app_id, domain, path, status_code, method, bucket)

-- migrate:down
DROP TABLE IF EXISTS http_rule_metrics;