-- migrate:up
CREATE MATERIALIZED VIEW http_events_mv TO http_events AS
SELECT
    `team_id`,
    `app_id`,
    `id` AS `event_id`,
    `session_id` AS `session_id`,
    protocol(`http.url`) AS `protocol`,
    port(`http.url`) AS `port`,
    domain(`http.url`) AS `domain`,
    path(`http.url`) AS `path`,
    `http.url` AS `url`,
    `http.method` AS `method`,
    `http.status_code` AS `status_code`,
    multiIf(
        `http.status_code` >= 500, '5xx',
        `http.status_code` >= 400, '4xx',
        `http.status_code` >= 300, '3xx',
        `http.status_code` >= 200, '2xx',
        `http.status_code` >= 100, '1xx',
        'unknown'
    ) AS `status_code_bucket`,
    `http.failure_reason` AS `failure_reason`,
    `http.failure_description` AS `failure_description`,
    `timestamp` AS `timestamp`,
    `http.end_time` AS `end_time`,
    `http.start_time` AS `start_time`,
    if(`http.start_time` > 0 AND `http.end_time` >= `http.start_time`, `http.end_time` - `http.start_time`, 0) AS `latency_ms`,
    (toString(`attribute.app_version`), toString(`attribute.app_build`)) AS `app_version`,
    (toString(`attribute.os_name`), toString(`attribute.os_version`)) AS `os_version`,
    `attribute.network_provider` AS `network_provider`,
    `attribute.network_type` AS `network_type`,
    `attribute.network_generation` AS `network_generation`,
    `attribute.device_locale` AS `device_locale`,
    `attribute.device_manufacturer` AS `device_manufacturer`,
    `attribute.device_name` AS `device_name`,
    `inserted_at` AS `inserted_at`
FROM
    events
WHERE
    type = 'http';

-- migrate:down
DROP VIEW IF EXISTS http_events_mv;