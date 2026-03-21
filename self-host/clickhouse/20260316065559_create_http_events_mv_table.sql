-- migrate:up
create materialized view http_events_mv to http_events as
select
    `team_id`,
    `app_id`,
    `id` as `event_id`,
    `session_id` as `session_id`,
    protocol(`http.url`) as `protocol`,
    port(`http.url`) as `port`,
    domain(`http.url`) as `domain`,
    path(`http.url`) as `path`,
    `http.url` as `url`,
    `http.method` as `method`,
    `http.status_code` as `status_code`,
    multiIf(
        `http.status_code` >= 500, '5xx',
        `http.status_code` >= 400, '4xx',
        `http.status_code` >= 300, '3xx',
        `http.status_code` >= 200, '2xx',
        `http.status_code` >= 100, '1xx',
        'unknown'
    ) as `status_code_bucket`,
    `http.failure_reason` as `failure_reason`,
    `http.failure_description` as `failure_description`,
    `timestamp` as `timestamp`,
    `inserted_at` as `inserted_at`,
    `http.end_time` as `end_time`,
    `http.start_time` as `start_time`,
    `http.end_time` - `http.start_time` as `latency_ms`,
    -- Old SDK versions (Android <0.16.2 and iOS <0.9.2) do not send
    -- session_start_time, set the elapsed time for such events to 0
    if(`attribute.session_start_time` > toDateTime(0),
      toUnixTimestamp64Milli(`timestamp`) - toUnixTimestamp64Milli(`attribute.session_start_time`),
      0) as `session_elapsed_ms`,
    (`attribute.app_version`, `attribute.app_build`) as `attribute.app_version`,
    (`attribute.os_name`, `attribute.os_version`) as `attribute.os_version`,
    `attribute.network_provider` as `attribute.network_provider`,
    `attribute.network_type` as `attribute.network_type`,
    `attribute.network_generation` as `attribute.network_generation`,
    `attribute.device_locale` as `attribute.device_locale`,
    `attribute.device_manufacturer` as `attribute.device_manufacturer`,
    `attribute.device_name` as `attribute.device_name`,
    `inet.country_code` as `inet.country_code`
FROM
    events
WHERE
    type = 'http'
    AND domain != '';

-- migrate:down
DROP VIEW IF EXISTS http_events_mv;
