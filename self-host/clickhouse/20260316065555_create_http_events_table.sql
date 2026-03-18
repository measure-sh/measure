-- migrate:up
create table if not exists http_events
(
    `team_id` LowCardinality(UUID) comment 'team id to which this event belongs to' CODEC(LZ4),
    `app_id` LowCardinality(UUID) comment 'app id to which this event belongs to' CODEC(LZ4),
    `event_id` UUID comment 'event id for this http event' CODEC(LZ4),
    `session_id` UUID comment 'session id for the session during which this event occurred' CODEC(LZ4),
    `protocol` LowCardinality(String) comment 'protocol used for the request (http, https, etc.)' CODEC(ZSTD(3)),
    `port` UInt16 comment 'port number used for the request, 0 if not specified' CODEC(ZSTD(3)),
    `domain` String comment 'domain of the http request' CODEC(ZSTD(3)),
    `path` String comment 'path of the http request' CODEC(ZSTD(3)),
    `url` String comment 'full raw url of the http request' CODEC(ZSTD(3)),
    `method` LowCardinality(String) comment 'method used for the http request (GET, POST, etc.)' CODEC(ZSTD(3)),
    `status_code` UInt16 comment 'http status code of the response, 0 if request failed to complete' CODEC(ZSTD(3)),
    `status_code_bucket` LowCardinality(String) comment 'bucketed status code for aggregation (1xx, 2xx, 3xx, 4xx, 5xx, unknown)' CODEC(ZSTD(3)),
    `failure_reason` LowCardinality(String) comment 'reason for request failure' CODEC(ZSTD(3)),
    `failure_description` String comment 'detailed description of the request failure' CODEC(ZSTD(3)),
    `timestamp` DateTime64(3, 'UTC') comment 'event timestamp in UTC' CODEC(DoubleDelta, ZSTD(3)),
    `inserted_at` DateTime64(3, 'UTC') comment 'server insertion timestamp' CODEC(Delta(8), ZSTD(3)),
    `end_time` UInt64 comment 'end time of the http request' CODEC(ZSTD(3)),
    `start_time` UInt64 comment 'start time of the http request' CODEC(ZSTD(3)),
    `latency_ms` UInt64 comment 'latency of the http request in milliseconds, calculated as end_time - start_time' CODEC(ZSTD(3)),
    `session_elapsed_ms` UInt64 comment 'milliseconds elapsed since session start' CODEC(ZSTD(3)),
    `attribute.app_version` Tuple(LowCardinality(String), LowCardinality(String)) comment 'app version (version, build)' CODEC(ZSTD(3)),
    `attribute.os_version` Tuple(LowCardinality(String), LowCardinality(String)) comment 'os version (name, version)' CODEC(ZSTD(3)),
    `attribute.network_provider` LowCardinality(String) comment 'network provider (AT&T, Verizon, etc.)' CODEC(ZSTD(3)),
    `attribute.network_type` LowCardinality(String) comment 'network type (wifi, cellular, etc.)' CODEC(ZSTD(3)),
    `attribute.network_generation` LowCardinality(String) comment 'network generation (3G, 4G, 5G, etc.)' CODEC(ZSTD(3)),
    `attribute.device_locale` LowCardinality(String) comment 'device locale (en-US, fr-FR, etc.)' CODEC(ZSTD(3)),
    `attribute.device_manufacturer` LowCardinality(String) comment 'device manufacturer (Apple, Samsung, etc.)' CODEC(ZSTD(3)),
    `attribute.device_name` LowCardinality(String) comment 'device name (iPhone 12, Galaxy S21, etc.)' CODEC(ZSTD(3)),
    `inet.country_code` LowCardinality(String) comment 'country code (US, IN, etc.)' CODEC(ZSTD(3)),
    INDEX idx_inserted_at inserted_at TYPE minmax GRANULARITY 1,
    INDEX idx_app_version `attribute.app_version` TYPE set(500) GRANULARITY 2,
    INDEX idx_os_version `attribute.os_version` TYPE set(500) GRANULARITY 2,
    INDEX idx_network_provider `attribute.network_provider` TYPE set(5000) GRANULARITY 2,
    INDEX idx_network_type `attribute.network_type` TYPE set(100) GRANULARITY 2,
    INDEX idx_network_generation `attribute.network_generation` TYPE set(100) GRANULARITY 2,
    INDEX idx_device_locale `attribute.device_locale` TYPE set(3000) GRANULARITY 2,
    INDEX idx_device_manufacturer `attribute.device_manufacturer` TYPE set(2000) GRANULARITY 2,
    INDEX idx_device_name `attribute.device_name` TYPE bloom_filter(0.25) GRANULARITY 2,
    INDEX idx_country_code `inet.country_code` TYPE set(500) GRANULARITY 2,
    INDEX idx_path `path` TYPE tokenbf_v1(1024, 4, 1) GRANULARITY 2,
    INDEX idx_path_lower lower(`path`) TYPE ngrambf_v1(3, 2048, 4, 1) GRANULARITY 2,
    INDEX idx_timestamp `timestamp` TYPE minmax GRANULARITY 1
)
engine = ReplacingMergeTree()
partition by toYYYYMM(`timestamp`)
primary key (`team_id`, `app_id`, `domain`)
order by (`team_id`, `app_id`, `domain`, `timestamp`)
comment 'raw http events'

-- migrate:down
drop table if exists http_events;
