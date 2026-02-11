-- migrate:up
CREATE MATERIALIZED VIEW http_mv TO http AS
SELECT
    `team_id`,
    `app_id`,
    concat(protocol(`http.url`), '://', domain(`http.url`)) AS `origin`,
    toString(`http.method`) AS `method`,
    path(`http.url`) AS `path`,
    `id` AS `event_id`,
    toStartOfFiveMinutes(`timestamp`) AS `bucket`,
    `http.status_code` AS `status_code`,
    `http.end_time` - `http.start_time` AS `duration`,
    toString(`attribute.installation_id`) AS `attribute.installation_id`,
    toString(`attribute.app_unique_id`) AS `attribute.app_unique_id`,
    toString(`attribute.platform`) AS `attribute.platform`,
    toString(`attribute.measure_sdk_version`) AS `attribute.measure_sdk_version`,
    toString(`attribute.thread_name`) AS `attribute.thread_name`,
    toString(`attribute.user_id`) AS `attribute.user_id`,
    toString(`attribute.device_name`) AS `attribute.device_name`,
    toString(`attribute.device_model`) AS `attribute.device_model`,
    toString(`attribute.device_manufacturer`) AS `attribute.device_manufacturer`,
    toString(`attribute.device_type`) AS `attribute.device_type`,
    `attribute.device_is_foldable`,
    `attribute.device_is_physical`,
    `attribute.device_density_dpi`,
    `attribute.device_width_px`,
    `attribute.device_height_px`,
    `attribute.device_density`,
    toString(`attribute.device_locale`) AS `attribute.device_locale`,
    `attribute.device_low_power_mode`,
    `attribute.device_thermal_throttling_enabled`,
    toString(`attribute.device_cpu_arch`) AS `attribute.device_cpu_arch`,
    toString(`attribute.os_name`) AS `attribute.os_name`,
    toString(`attribute.os_version`) AS `attribute.os_version`,
    `attribute.os_page_size`,
    toString(`attribute.network_type`) AS `attribute.network_type`,
    toString(`attribute.network_generation`) AS `attribute.network_generation`,
    toString(`attribute.network_provider`) AS `attribute.network_provider`,
    toString(`attribute.app_version`) AS `attribute.app_version`,
    toString(`attribute.app_build`) AS `attribute.app_build`
FROM
    events
WHERE
    type = 'http';

-- migrate:down
DROP VIEW IF EXISTS http_mv;
