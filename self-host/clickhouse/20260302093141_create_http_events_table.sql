-- migrate:up
create table http_events
(
    `team_id` UUID comment 'team id to which this event belongs to',
    `app_id` UUID comment 'app id to which this event belongs to',
    `event_id` UUID comment 'event id for this http event',
    `session_id` UUID comment 'session id for the session during which this event occurred',
    `protocol` LowCardinality(String) comment 'protocol used for the request (http, https, etc.)',
    `port` UInt16 comment 'port number used for the request, 0 if not specified',
    `domain` String comment 'domain of the http request',
    `path` String comment 'path of the http request',
    `url` String comment 'full raw url of the http request',
    `method` LowCardinality(String) comment 'method used for the http request (GET, POST, etc.)',
    `status_code` UInt16 comment 'http status code of the response, 0 if request failed to complete',
    `status_code_bucket` LowCardinality(String) comment 'bucketed status code for aggregation (1xx, 2xx, 3xx, 4xx, 5xx, unknown)',
    `failure_reason` LowCardinality(String) comment 'reason for request failure',
    `failure_description` String comment 'detailed description of the request failure',
    `timestamp` DateTime64(3) comment 'event timestamp in UTC',
    `inserted_at` DateTime64(3, 'UTC') DEFAULT timestamp comment 'server insertion timestamp',
    `end_time` UInt64 comment 'end time of the http request',
    `start_time` UInt64 comment 'start time of the http request',
    `latency_ms` Int64 comment 'latency of the http request in milliseconds, calculated as end_time - start_time',
    `session_elapsed_ms` Int64 comment 'milliseconds elapsed since session start',
    `app_version` Tuple(LowCardinality(String), LowCardinality(String)) comment 'app version (version, build)',
    `os_version` Tuple(LowCardinality(String), LowCardinality(String)) comment 'os version (name, version)',
    `network_provider` LowCardinality(String) comment 'network provider (AT&T, Verizon, etc.)',
    `network_type` LowCardinality(String) comment 'network type (wifi, cellular, etc.)',
    `network_generation` LowCardinality(String) comment 'network generation (3G, 4G, 5G, etc.)',
    `device_locale` LowCardinality(String) comment 'device locale (en-US, fr-FR, etc.)',
    `device_manufacturer` LowCardinality(String) comment 'device manufacturer (Apple, Samsung, etc.)',
    `device_name` LowCardinality(String) comment 'device name (iPhone 12, Galaxy S21, etc.)',
    INDEX idx_inserted_at inserted_at TYPE minmax GRANULARITY 1,
    INDEX idx_network_type `network_type` TYPE set(100) GRANULARITY 2,
    INDEX idx_network_generation `network_generation` TYPE set(100) GRANULARITY 2,
    INDEX idx_network_provider `network_provider` TYPE set(5000) GRANULARITY 2,
    INDEX idx_device_locale `device_locale` TYPE set(3000) GRANULARITY 2,
    INDEX idx_device_manufacturer `device_manufacturer` TYPE set(2000) GRANULARITY 2,
    INDEX idx_app_version `app_version` TYPE set(500) GRANULARITY 2,
    INDEX idx_os_version `os_version` TYPE set(500) GRANULARITY 2
)
engine = MergeTree
partition by toYYYYMM(`timestamp`)
order by (`team_id`, `app_id`, `domain`, `path`, `status_code`, `method`, `timestamp`)
comment 'raw http events'

-- migrate:down
drop table if exists http_events;
