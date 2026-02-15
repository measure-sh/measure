-- migrate:up
create table http_events
(
    `team_id` uuid comment 'team id to which this event belongs to',
    `app_id` uuid comment 'app id to which this event belongs to',
    `event_id` uuid comment 'event id for this http event',
    `session_id` uuid comment 'session id for the session during which this event occurred',
    `protocol` LowCardinality(String) comment 'protocol used for the request (http, https, etc.)',
    `port` UInt16 comment 'port number used for the request, 0 if not specified',
    `domain` String comment 'domain of the http request',
    `path` String comment 'path of the http request',
    `url` String comment 'full raw url of the http request',
    `method` LowCardinality(String) comment 'method used for the http request (GET, POST, etc.)',
    `status_code` UInt16 comment 'http status code of the response, 0 if request failed to complete',
    `status_code_bucket` LowCardinality(String) comment 'bucketed status code for aggregation (1xx, 2xx, 3xx, 4xx, 5xx, unknown)',
    `is_error` Bool comment 'true if status_code >= 400',
    `is_server_error` Bool comment 'true if status_code >= 500',
    `is_failed_request` Bool comment 'true if status_code is 0 or null, indicating the request failed to complete',
    `failure_reason` LowCardinality(String) comment 'reason for request failure',
    `failure_description` String comment 'detailed description of the request failure',
    `timestamp` DateTime64(3) comment 'event timestamp in UTC',
    `end_time` UInt64 comment 'end time of the http request',
    `start_time` UInt64 comment 'start time of the http request',
    `latency_ms` Int64 comment 'latency of the http request in milliseconds, calculated as end_time - start_time',
    `app_version` Tuple(LowCardinality(String), LowCardinality(String)) comment 'app version (version, build)',
    `os_version` Tuple(LowCardinality(String), LowCardinality(String)) comment 'os version (name, version)',
    `network_provider` LowCardinality(String) comment 'network provider (AT&T, Verizon, etc.)',
    `network_type` LowCardinality(String) comment 'network type (wifi, cellular, etc.)',
    `network_generation` LowCardinality(String) comment 'network generation (3G, 4G, 5G, etc.)',
    `device_locale` LowCardinality(String) comment 'device locale (en-US, fr-FR, etc.)',
    `device_manufacturer` LowCardinality(String) comment 'device manufacturer (Apple, Samsung, etc.)',
    `device_name` LowCardinality(String) comment 'device name (iPhone 12, Galaxy S21, etc.)',
    `device_model` LowCardinality(String) comment 'device model (iPhone, Galaxy, etc.)'
)
engine = MergeTree
partition by toYYYYMM(`timestamp`)
order by (`team_id`, `app_id`, `domain`, `path`, `status_code`, `method`, `timestamp`)

-- migrate:down
drop table if exists http_events;