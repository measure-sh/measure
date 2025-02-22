
--
-- Database schema
--

CREATE DATABASE IF NOT EXISTS default;

CREATE TABLE default.app_filters
(
    `app_id` UUID COMMENT 'associated app id' CODEC(LZ4),
    `end_of_month` DateTime COMMENT 'last day of the month' CODEC(DoubleDelta, ZSTD(3)),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite app version' CODEC(ZSTD(3)),
    `os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite os version' CODEC(ZSTD(3)),
    `country_code` LowCardinality(String) COMMENT 'country code' CODEC(ZSTD(3)),
    `network_provider` LowCardinality(String) COMMENT 'network provider' CODEC(ZSTD(3)),
    `network_type` LowCardinality(String) COMMENT 'network type' CODEC(ZSTD(3)),
    `network_generation` LowCardinality(String) COMMENT 'network generation' CODEC(ZSTD(3)),
    `device_locale` LowCardinality(String) COMMENT 'device locale' CODEC(ZSTD(3)),
    `device_manufacturer` LowCardinality(String) COMMENT 'device manufacturer' CODEC(ZSTD(3)),
    `device_name` LowCardinality(String) COMMENT 'device name' CODEC(ZSTD(3)),
    `exception` Bool COMMENT 'true if source is exception event' CODEC(ZSTD(3)),
    `anr` Bool COMMENT 'true if source is anr event' CODEC(ZSTD(3))
)
ENGINE = ReplacingMergeTree
ORDER BY (app_id, end_of_month, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name, exception, anr)
SETTINGS index_granularity = 8192
COMMENT 'derived app filters';

CREATE MATERIALIZED VIEW default.app_filters_mv TO default.app_filters
(
    `app_id` UUID,
    `end_of_month` Date,
    `app_version` Tuple(
        LowCardinality(String),
        String),
    `os_version` Tuple(
        LowCardinality(String),
        String),
    `country_code` LowCardinality(String),
    `network_provider` String,
    `network_type` LowCardinality(String),
    `network_generation` LowCardinality(String),
    `device_locale` LowCardinality(String),
    `device_manufacturer` String,
    `device_name` String,
    `exception` Bool,
    `anr` Bool
)
AS SELECT DISTINCT
    app_id,
    toLastDayOfMonth(timestamp) AS end_of_month,
    (toString(attribute.app_version), toString(attribute.app_build)) AS app_version,
    (toString(attribute.os_name), toString(attribute.os_version)) AS os_version,
    toString(inet.country_code) AS country_code,
    toString(attribute.network_provider) AS network_provider,
    toString(attribute.network_type) AS network_type,
    toString(attribute.network_generation) AS network_generation,
    toString(attribute.device_locale) AS device_locale,
    toString(attribute.device_manufacturer) AS device_manufacturer,
    toString(attribute.device_name) AS device_name,
    if((type = 'exception') AND (`exception.handled` = false), true, false) AS exception,
    if(type = 'anr', true, false) AS anr
FROM default.events
WHERE (toString(attribute.os_name) != '') AND (toString(attribute.os_version) != '') AND (toString(inet.country_code) != '') AND (toString(attribute.network_provider) != '') AND (toString(attribute.network_type) != '') AND (toString(attribute.network_generation) != '') AND (toString(attribute.device_locale) != '') AND (toString(attribute.device_manufacturer) != '') AND (toString(attribute.device_name) != '')
GROUP BY
    app_id,
    end_of_month,
    attribute.app_version,
    attribute.app_build,
    attribute.os_name,
    attribute.os_version,
    inet.country_code,
    attribute.network_provider,
    attribute.network_type,
    attribute.network_generation,
    attribute.device_locale,
    attribute.device_manufacturer,
    attribute.device_name,
    type,
    exception.handled
ORDER BY app_id ASC;

CREATE TABLE default.app_metrics
(
    `app_id` UUID COMMENT 'associated app id' CODEC(ZSTD(3)),
    `timestamp` DateTime64(3, 'UTC') COMMENT 'interval metrics will be aggregated to' CODEC(DoubleDelta, ZSTD(3)),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite app version' CODEC(ZSTD(3)),
    `unique_sessions` AggregateFunction(uniq, UUID) COMMENT 'unique sessions in interval window' CODEC(ZSTD(3)),
    `crash_sessions` AggregateFunction(uniq, UUID) COMMENT 'crash sessions in interval window' CODEC(ZSTD(3)),
    `perceived_crash_sessions` AggregateFunction(uniq, UUID) COMMENT 'perceived crash sessions in interval window' CODEC(ZSTD(3)),
    `anr_sessions` AggregateFunction(uniq, UUID) COMMENT 'anr sessions in interval window' CODEC(ZSTD(3)),
    `perceived_anr_sessions` AggregateFunction(uniq, UUID) COMMENT 'perceived anr sessions in interval window' CODEC(ZSTD(3)),
    `cold_launch_p95` AggregateFunction(quantile(0.95), UInt32) COMMENT 'p95 quantile of cold launch duration' CODEC(ZSTD(3)),
    `warm_launch_p95` AggregateFunction(quantile(0.95), UInt32) COMMENT 'p95 quantile of warm launch duration' CODEC(ZSTD(3)),
    `hot_launch_p95` AggregateFunction(quantile(0.95), UInt32) COMMENT 'p95 quantile of hot launch duration' CODEC(ZSTD(3))
)
ENGINE = AggregatingMergeTree
ORDER BY (app_id, timestamp, app_version)
SETTINGS index_granularity = 8192
COMMENT 'aggregated app metrics by a fixed time window';

CREATE MATERIALIZED VIEW default.app_metrics_mv TO default.app_metrics
(
    `app_id` UUID,
    `timestamp` DateTime('UTC'),
    `app_version` Tuple(
        LowCardinality(String),
        String),
    `unique_sessions` AggregateFunction(uniq, UUID),
    `crash_sessions` AggregateFunction(uniq, UUID),
    `perceived_crash_sessions` AggregateFunction(uniq, UUID),
    `anr_sessions` AggregateFunction(uniq, UUID),
    `perceived_anr_sessions` AggregateFunction(uniq, UUID),
    `cold_launch_p95` AggregateFunction(quantile(0.95), UInt32),
    `warm_launch_p95` AggregateFunction(quantile(0.95), UInt32),
    `hot_launch_p95` AggregateFunction(quantile(0.95), UInt32)
)
AS SELECT
    app_id,
    toStartOfFifteenMinutes(timestamp) AS timestamp,
    (toString(attribute.app_version), toString(attribute.app_build)) AS app_version,
    uniqState(session_id) AS unique_sessions,
    uniqStateIf(session_id, (type = 'exception') AND (exception.handled = false)) AS crash_sessions,
    uniqStateIf(session_id, (type = 'exception') AND (exception.handled = false) AND (exception.foreground = true)) AS perceived_crash_sessions,
    uniqStateIf(session_id, type = 'anr') AS anr_sessions,
    uniqStateIf(session_id, (type = 'anr') AND (anr.foreground = true)) AS perceived_anr_sessions,
    quantileStateIf(0.95)(cold_launch.duration, (type = 'cold_launch') AND (cold_launch.duration > 0) AND (cold_launch.duration <= 30000)) AS cold_launch_p95,
    quantileStateIf(0.95)(warm_launch.duration, (type = 'warm_launch') AND (warm_launch.duration > 0) AND (warm_launch.duration <= 10000)) AS warm_launch_p95,
    quantileStateIf(0.95)(hot_launch.duration, (type = 'hot_launch') AND (hot_launch.duration > 0)) AS hot_launch_p95
FROM default.events
GROUP BY
    app_id,
    timestamp,
    app_version
ORDER BY
    app_id ASC,
    timestamp ASC,
    app_version ASC;

CREATE TABLE default.bug_reports
(
    `event_id` UUID COMMENT 'bug report event id' CODEC(ZSTD(3)),
    `app_id` UUID COMMENT 'unique id of the app' CODEC(ZSTD(3)),
    `session_id` UUID COMMENT 'session id' CODEC(ZSTD(3)),
    `timestamp` DateTime64(9, 'UTC') COMMENT 'timestamp of the bug report' CODEC(DoubleDelta, ZSTD(3)),
    `status` UInt8 COMMENT 'status of the bug report 0 (Closed) or 1 (Open)' CODEC(ZSTD(3)),
    `description` String COMMENT 'description of the bug report' CODEC(ZSTD(3)),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite app version' CODEC(ZSTD(3)),
    `os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite os version' CODEC(ZSTD(3)),
    `country_code` LowCardinality(String) COMMENT 'country code' CODEC(ZSTD(3)),
    `network_provider` LowCardinality(String) COMMENT 'name of the network service provider' CODEC(ZSTD(3)),
    `network_type` LowCardinality(String) COMMENT 'wifi, cellular, vpn and so on' CODEC(ZSTD(3)),
    `network_generation` LowCardinality(String) COMMENT '2g, 3g, 4g and so on' CODEC(ZSTD(3)),
    `device_locale` LowCardinality(String) COMMENT 'rfc 5646 locale string' CODEC(ZSTD(3)),
    `device_manufacturer` LowCardinality(String) COMMENT 'manufacturer of the device' CODEC(ZSTD(3)),
    `device_name` LowCardinality(String) COMMENT 'name of the device' CODEC(ZSTD(3)),
    `device_model` LowCardinality(String) COMMENT 'model of the device' CODEC(ZSTD(3)),
    `user_id` LowCardinality(String) COMMENT 'attributed user id' CODEC(ZSTD(3)),
    `device_low_power_mode` Bool COMMENT 'true if low power mode is enabled',
    `device_thermal_throttling_enabled` Bool COMMENT 'true if thermal throttling is enabled',
    `user_defined_attribute` Map(LowCardinality(String), Tuple(
        Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4),
        String)) COMMENT 'user defined attributes' CODEC(ZSTD(3)),
    `attachments` String COMMENT 'attachment metadata'
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (app_id, os_version, app_version, session_id, timestamp, event_id)
SETTINGS index_granularity = 8192
COMMENT 'aggregated app bug reports';

CREATE MATERIALIZED VIEW default.bug_reports_mv TO default.bug_reports
(
    `event_id` UUID,
    `app_id` UUID,
    `session_id` UUID,
    `timestamp` DateTime64(9, 'UTC'),
    `status` UInt8,
    `description` String,
    `app_version` Tuple(
        String,
        String),
    `os_version` Tuple(
        String,
        String),
    `country_code` String,
    `network_provider` String,
    `network_type` String,
    `network_generation` String,
    `device_locale` String,
    `device_manufacturer` String,
    `device_name` String,
    `device_model` String,
    `user_id` String,
    `device_low_power_mode` Bool,
    `device_thermal_throttling_enabled` Bool,
    `user_defined_attribute` Map(String, Tuple(
        Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4),
        String)),
    `attachments` String
)
AS SELECT DISTINCT
    id AS event_id,
    app_id,
    session_id,
    any(timestamp) AS timestamp,
    0 AS status,
    any(bug_report.description) AS description,
    any((toString(attribute.app_version), toString(attribute.app_build))) AS app_version,
    any((toString(attribute.os_name), toString(attribute.os_version))) AS os_version,
    any(toString(inet.country_code)) AS country_code,
    any(toString(attribute.network_provider)) AS network_provider,
    any(toString(attribute.network_type)) AS network_type,
    any(toString(attribute.network_generation)) AS network_generation,
    any(toString(attribute.device_locale)) AS device_locale,
    any(toString(attribute.device_manufacturer)) AS device_manufacturer,
    any(toString(attribute.device_name)) AS device_name,
    any(toString(attribute.device_model)) AS device_model,
    any(toString(attribute.user_id)) AS user_id,
    any(attribute.device_low_power_mode) AS device_low_power_mode,
    any(attribute.device_thermal_throttling_enabled) AS device_thermal_throttling_enabled,
    any(user_defined_attribute) AS user_defined_attribute,
    any(attachments) AS attachments
FROM default.events
WHERE type = 'bug_report'
GROUP BY
    app_id,
    session_id,
    event_id
ORDER BY
    app_id ASC,
    os_version ASC,
    app_version ASC,
    session_id ASC,
    timestamp ASC,
    event_id ASC;

CREATE TABLE default.events
(
    `id` UUID COMMENT 'unique event id' CODEC(LZ4),
    `type` LowCardinality(FixedString(32)) COMMENT 'type of the event' CODEC(ZSTD(3)),
    `session_id` UUID COMMENT 'associated session id' CODEC(LZ4),
    `app_id` UUID COMMENT 'associated app id',
    `inet.ipv4` Nullable(IPv4) COMMENT 'ipv4 address' CODEC(ZSTD(3)),
    `inet.ipv6` Nullable(IPv6) COMMENT 'ipv6 address' CODEC(ZSTD(3)),
    `inet.country_code` LowCardinality(FixedString(8)) COMMENT 'country code' CODEC(ZSTD(3)),
    `timestamp` DateTime64(9, 'UTC') COMMENT 'event timestamp' CODEC(DoubleDelta, ZSTD(3)),
    `user_triggered` Bool COMMENT 'true if user chose to trigger by themselves' CODEC(ZSTD(3)),
    `attribute.installation_id` UUID COMMENT 'unique id for an installation of an app, generated by sdk' CODEC(LZ4),
    `attribute.app_version` LowCardinality(FixedString(128)) COMMENT 'app version identifier' CODEC(ZSTD(3)),
    `attribute.app_build` FixedString(32) COMMENT 'app build identifier' CODEC(ZSTD(3)),
    `attribute.app_unique_id` LowCardinality(FixedString(128)) COMMENT 'app bundle identifier' CODEC(ZSTD(3)),
    `attribute.platform` LowCardinality(FixedString(32)) COMMENT 'platform identifier' CODEC(ZSTD(3)),
    `attribute.measure_sdk_version` FixedString(16) COMMENT 'measure sdk version identifier' CODEC(ZSTD(3)),
    `attribute.thread_name` FixedString(128) COMMENT 'thread on which the event was captured' CODEC(ZSTD(3)),
    `attribute.user_id` FixedString(128) COMMENT 'id of the app\'s end user' CODEC(ZSTD(3)),
    `attribute.device_name` FixedString(32) COMMENT 'name of the device' CODEC(ZSTD(3)),
    `attribute.device_model` FixedString(32) COMMENT 'model of the device' CODEC(ZSTD(3)),
    `attribute.device_manufacturer` FixedString(32) COMMENT 'manufacturer of the device' CODEC(ZSTD(3)),
    `attribute.device_type` LowCardinality(FixedString(32)) COMMENT 'type of the device, like phone or tablet' CODEC(ZSTD(3)),
    `attribute.device_is_foldable` Bool COMMENT 'true for foldable devices' CODEC(ZSTD(3)),
    `attribute.device_is_physical` Bool COMMENT 'true for physical devices' CODEC(ZSTD(3)),
    `attribute.device_density_dpi` UInt16 COMMENT 'dpi density' CODEC(Delta(2), ZSTD(3)),
    `attribute.device_width_px` UInt16 COMMENT 'screen width' CODEC(Delta(2), ZSTD(3)),
    `attribute.device_height_px` UInt16 COMMENT 'screen height' CODEC(Delta(2), ZSTD(3)),
    `attribute.device_density` Float32 COMMENT 'device density' CODEC(Delta(4), ZSTD(3)),
    `attribute.device_locale` LowCardinality(FixedString(64)) COMMENT 'rfc 5646 locale string' CODEC(ZSTD(3)),
    `attribute.device_low_power_mode` Bool COMMENT 'true if low power mode is enabled',
    `attribute.device_thermal_throttling_enabled` Bool COMMENT 'true if thermal throttling is enabled',
    `attribute.device_cpu_arch` LowCardinality(FixedString(16)) COMMENT 'cpu architecture like arm64 and so on',
    `attribute.os_name` LowCardinality(FixedString(32)) COMMENT 'name of the operating system' CODEC(ZSTD(3)),
    `attribute.os_version` FixedString(32) COMMENT 'version of the operating system' CODEC(ZSTD(3)),
    `attribute.os_page_size` UInt8 COMMENT 'memory page size' CODEC(Delta(1), ZSTD(3)),
    `attribute.network_type` LowCardinality(FixedString(16)) COMMENT 'either - wifi, cellular, vpn, unknown, no_network' CODEC(ZSTD(3)),
    `attribute.network_generation` LowCardinality(FixedString(8)) COMMENT 'either - 2g, 3g, 4g, 5g, unknown' CODEC(ZSTD(3)),
    `attribute.network_provider` FixedString(64) COMMENT 'name of the network service provider' CODEC(ZSTD(3)),
    `user_defined_attribute` Map(LowCardinality(String), Tuple(
        Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4),
        String)) CODEC(ZSTD(3)),
    `anr.handled` Bool COMMENT 'anr was handled by the application code' CODEC(ZSTD(3)),
    `anr.fingerprint` FixedString(32) COMMENT 'fingerprint for anr similarity classification' CODEC(ZSTD(3)),
    `anr.exceptions` String COMMENT 'anr exception data' CODEC(ZSTD(3)),
    `anr.threads` String COMMENT 'anr thread data' CODEC(ZSTD(3)),
    `anr.foreground` Bool COMMENT 'true if the anr was perceived by end user' CODEC(ZSTD(3)),
    `exception.handled` Bool COMMENT 'exception was handled by application code' CODEC(ZSTD(3)),
    `exception.fingerprint` FixedString(32) COMMENT 'fingerprint for exception similarity classification' CODEC(ZSTD(3)),
    `exception.exceptions` String COMMENT 'exception data' CODEC(ZSTD(3)),
    `exception.threads` String COMMENT 'exception thread data' CODEC(ZSTD(3)),
    `exception.foreground` Bool COMMENT 'true if the exception was perceived by end user' CODEC(ZSTD(3)),
    `app_exit.reason` LowCardinality(FixedString(64)) COMMENT 'reason for app exit' CODEC(ZSTD(3)),
    `app_exit.importance` LowCardinality(FixedString(32)) COMMENT 'importance of process that it used to have before death' CODEC(ZSTD(3)),
    `app_exit.trace` String COMMENT 'modified trace given by ApplicationExitInfo to help debug anrs.' CODEC(ZSTD(3)),
    `app_exit.process_name` String COMMENT 'name of the process that died' CODEC(ZSTD(3)),
    `app_exit.pid` String COMMENT 'id of the process that died' CODEC(ZSTD(3)),
    `string.severity_text` LowCardinality(FixedString(10)) COMMENT 'log level - info, warning, error, fatal, debug' CODEC(ZSTD(3)),
    `string.string` String COMMENT 'log message text' CODEC(ZSTD(3)),
    `gesture_long_click.target` FixedString(128) COMMENT 'class or instance name of the originating view' CODEC(ZSTD(3)),
    `gesture_long_click.target_id` FixedString(128) COMMENT 'unique identifier of the target' CODEC(ZSTD(3)),
    `gesture_long_click.touch_down_time` UInt64 COMMENT 'time for touch down gesture' CODEC(T64, ZSTD(3)),
    `gesture_long_click.touch_up_time` UInt64 COMMENT 'time for touch up gesture' CODEC(T64, ZSTD(3)),
    `gesture_long_click.width` UInt16 COMMENT 'width of the target view in pixels' CODEC(T64, ZSTD(3)),
    `gesture_long_click.height` UInt16 COMMENT 'height of the target view in pixels' CODEC(T64, ZSTD(3)),
    `gesture_long_click.x` Float32 COMMENT 'x coordinate of where the gesture happened' CODEC(Delta(4), ZSTD(3)),
    `gesture_long_click.y` Float32 COMMENT 'y coordinate of where the gesture happened' CODEC(Delta(4), ZSTD(3)),
    `gesture_click.target` FixedString(128) COMMENT 'class or instance name of the originating view' CODEC(ZSTD(3)),
    `gesture_click.target_id` FixedString(128) COMMENT 'unique identifier of the target' CODEC(ZSTD(3)),
    `gesture_click.touch_down_time` UInt64 COMMENT 'time for touch down gesture' CODEC(T64, ZSTD(3)),
    `gesture_click.touch_up_time` UInt64 COMMENT 'time for the touch up gesture' CODEC(T64, ZSTD(3)),
    `gesture_click.width` UInt16 COMMENT 'width of the target view in pixels' CODEC(Delta(2), ZSTD(3)),
    `gesture_click.height` UInt16 COMMENT 'height of the target view in pixels' CODEC(Delta(2), ZSTD(3)),
    `gesture_click.x` Float32 COMMENT 'x coordinate of where the gesture happened' CODEC(Delta(4), ZSTD(3)),
    `gesture_click.y` Float32 COMMENT 'y coordinate of where the gesture happened' CODEC(Delta(4), ZSTD(3)),
    `gesture_scroll.target` FixedString(128) COMMENT 'class or instance name of the originating view' CODEC(ZSTD(3)),
    `gesture_scroll.target_id` FixedString(128) COMMENT 'unique identifier of the target' CODEC(ZSTD(3)),
    `gesture_scroll.touch_down_time` UInt64 COMMENT 'time for touch down gesture' CODEC(T64, ZSTD(3)),
    `gesture_scroll.touch_up_time` UInt64 COMMENT 'time for touch up gesture' CODEC(T64, ZSTD(3)),
    `gesture_scroll.x` Float32 COMMENT 'x coordinate of where the gesture started' CODEC(Delta(4), ZSTD(3)),
    `gesture_scroll.y` Float32 COMMENT 'y coordinate of where the gesture started' CODEC(Delta(4), ZSTD(3)),
    `gesture_scroll.end_x` Float32 COMMENT 'x coordinate of where the gesture ended' CODEC(Delta(4), ZSTD(3)),
    `gesture_scroll.end_y` Float32 COMMENT 'y coordinate of where the gesture ended' CODEC(Delta(4), ZSTD(3)),
    `gesture_scroll.direction` LowCardinality(FixedString(8)) COMMENT 'direction of the scroll' CODEC(ZSTD(3)),
    `lifecycle_activity.type` LowCardinality(FixedString(32)) COMMENT 'type of the lifecycle activity, either - created, resumed, paused, destroyed' CODEC(ZSTD(3)),
    `lifecycle_activity.class_name` FixedString(128) COMMENT 'fully qualified class name of the activity' CODEC(ZSTD(3)),
    `lifecycle_activity.intent` String COMMENT 'intent data serialized as string' CODEC(ZSTD(3)),
    `lifecycle_activity.saved_instance_state` Bool COMMENT 'represents that activity was recreated with a saved state. only available for type created.' CODEC(ZSTD(3)),
    `lifecycle_fragment.type` LowCardinality(FixedString(32)) COMMENT 'type of the lifecycle fragment, either - attached, resumed, paused, detached' CODEC(ZSTD(3)),
    `lifecycle_fragment.class_name` FixedString(128) COMMENT 'fully qualified class name of the fragment' CODEC(ZSTD(3)),
    `lifecycle_fragment.parent_activity` String COMMENT 'fully qualified class name of the parent activity that the fragment is attached to' CODEC(ZSTD(3)),
    `lifecycle_fragment.parent_fragment` String COMMENT 'fully qualified class name of the parent fragment that the fragment is attached to' CODEC(ZSTD(3)),
    `lifecycle_fragment.tag` String COMMENT 'optional fragment tag' CODEC(ZSTD(3)),
    `lifecycle_view_controller.type` LowCardinality(FixedString(32)) COMMENT 'type of the iOS ViewController lifecycle event',
    `lifecycle_view_controller.class_name` LowCardinality(FixedString(256)) COMMENT 'class name of the iOS ViewController lifecycle event',
    `lifecycle_swift_ui.type` LowCardinality(FixedString(16)) COMMENT 'type of the iOS SwiftUI view lifecycle event',
    `lifecycle_swift_ui.class_name` LowCardinality(FixedString(256)) COMMENT 'class name of the iOS SwiftUI view lifecycle event',
    `lifecycle_app.type` LowCardinality(FixedString(32)) COMMENT 'type of the lifecycle app, either - background, foreground' CODEC(ZSTD(3)),
    `cold_launch.process_start_uptime` UInt64 COMMENT 'start uptime in msec' CODEC(T64, ZSTD(3)),
    `cold_launch.process_start_requested_uptime` UInt64 COMMENT 'start uptime in msec' CODEC(T64, ZSTD(3)),
    `cold_launch.content_provider_attach_uptime` UInt64 COMMENT 'start uptime in msec' CODEC(T64, ZSTD(3)),
    `cold_launch.on_next_draw_uptime` UInt64 COMMENT 'time at which app became visible' CODEC(T64, ZSTD(3)),
    `cold_launch.launched_activity` FixedString(128) COMMENT 'activity which drew the first frame during cold launch' CODEC(ZSTD(3)),
    `cold_launch.has_saved_state` Bool COMMENT 'whether the launched_activity was created with a saved state bundle' CODEC(ZSTD(3)),
    `cold_launch.intent_data` String COMMENT 'intent data used to launch the launched_activity' CODEC(ZSTD(3)),
    `cold_launch.duration` UInt32 COMMENT 'computed cold launch duration' CODEC(T64, ZSTD(3)),
    `warm_launch.app_visible_uptime` UInt64 COMMENT 'time since the app became visible to user, in msec',
    `warm_launch.process_start_uptime` UInt64 COMMENT 'start uptime in msec' CODEC(T64, ZSTD(3)),
    `warm_launch.process_start_requested_uptime` UInt64 COMMENT 'start uptime in msec' CODEC(T64, ZSTD(3)),
    `warm_launch.content_provider_attach_uptime` UInt64 COMMENT 'start uptime in msec' CODEC(T64, ZSTD(3)),
    `warm_launch.on_next_draw_uptime` UInt64 COMMENT 'time at which app became visible to user, in msec' CODEC(ZSTD(3)),
    `warm_launch.launched_activity` FixedString(128) COMMENT 'activity which drew the first frame during warm launch' CODEC(ZSTD(3)),
    `warm_launch.has_saved_state` Bool COMMENT 'whether the launched_activity was created with a saved state bundle' CODEC(ZSTD(3)),
    `warm_launch.intent_data` String COMMENT 'intent data used to launch the launched_activity' CODEC(ZSTD(3)),
    `warm_launch.duration` UInt32 COMMENT 'computed warm launch duration' CODEC(T64, ZSTD(3)),
    `warm_launch.is_lukewarm` Bool COMMENT 'whether it is a lukewarm launch' CODEC(ZSTD(3)),
    `hot_launch.app_visible_uptime` UInt64 COMMENT 'time elapsed since the app became visible to user, in msec' CODEC(T64, ZSTD(3)),
    `hot_launch.on_next_draw_uptime` UInt64 COMMENT 'time at which app became visible to user, in msec' CODEC(T64, ZSTD(3)),
    `hot_launch.launched_activity` FixedString(128) COMMENT 'activity which drew the first frame during hot launch' CODEC(ZSTD(3)),
    `hot_launch.has_saved_state` Bool COMMENT 'whether the launched_activity was created with a saved state bundle' CODEC(ZSTD(3)),
    `hot_launch.intent_data` String COMMENT 'intent data used to launch the launched_activity' CODEC(ZSTD(3)),
    `hot_launch.duration` UInt32 COMMENT 'computed hot launch duration' CODEC(T64, ZSTD(3)),
    `network_change.network_type` LowCardinality(FixedString(16)) COMMENT 'type of the network, wifi, cellular etc' CODEC(ZSTD(3)),
    `network_change.previous_network_type` LowCardinality(FixedString(16)) COMMENT 'type of the previous network' CODEC(ZSTD(3)),
    `network_change.network_generation` LowCardinality(FixedString(8)) COMMENT '2g, 3g, 4g etc' CODEC(ZSTD(3)),
    `network_change.previous_network_generation` LowCardinality(FixedString(8)) COMMENT 'previous network generation' CODEC(ZSTD(3)),
    `network_change.network_provider` FixedString(64) COMMENT 'name of the network service provider' CODEC(ZSTD(3)),
    `http.url` String COMMENT 'url of the http request' CODEC(ZSTD(3)),
    `http.method` LowCardinality(FixedString(16)) COMMENT 'method like get, post' CODEC(ZSTD(3)),
    `http.status_code` UInt16 COMMENT 'http status code' CODEC(T64, ZSTD(3)),
    `http.start_time` UInt64 COMMENT 'uptime at when the http call started, in msec' CODEC(T64, ZSTD(3)),
    `http.end_time` UInt64 COMMENT 'uptime at when the http call ended, in msec' CODEC(T64, ZSTD(3)),
    `http_request_headers` Map(String, String) COMMENT 'http request headers' CODEC(ZSTD(3)),
    `http_response_headers` Map(String, String) COMMENT 'http response headers' CODEC(ZSTD(3)),
    `http.request_body` String COMMENT 'request body' CODEC(ZSTD(3)),
    `http.response_body` String COMMENT 'response body' CODEC(ZSTD(3)),
    `http.failure_reason` String COMMENT 'reason for failure' CODEC(ZSTD(3)),
    `http.failure_description` String COMMENT 'description of the failure' CODEC(ZSTD(3)),
    `http.client` LowCardinality(FixedString(32)) COMMENT 'name of the http client' CODEC(ZSTD(3)),
    `memory_usage.java_max_heap` UInt64 COMMENT 'maximum size of the java heap allocated, in kb' CODEC(T64, ZSTD(3)),
    `memory_usage.java_total_heap` UInt64 COMMENT 'total size of the java heap available for allocation, in KB' CODEC(T64, ZSTD(3)),
    `memory_usage.java_free_heap` UInt64 COMMENT 'free memory available in the java heap, in kb' CODEC(T64, ZSTD(3)),
    `memory_usage.total_pss` UInt64 COMMENT 'total proportional set size - amount of memory used by the process, including shared memory and code. in kb.' CODEC(T64, ZSTD(3)),
    `memory_usage.rss` UInt64 COMMENT 'resident set size - amount of physical memory currently used, in kb' CODEC(T64, ZSTD(3)),
    `memory_usage.native_total_heap` UInt64 COMMENT 'total size of the native heap (memory out of java\'s control) available for allocation, in kb' CODEC(T64, ZSTD(3)),
    `memory_usage.native_free_heap` UInt64 COMMENT 'amount of free memory available in the native heap, in kb' CODEC(T64, ZSTD(3)),
    `memory_usage.interval` UInt64 COMMENT 'interval between two consecutive readings, in msec' CODEC(T64, ZSTD(3)),
    `memory_usage_absolute.max_memory` UInt64 COMMENT 'maximum memory available to the application, in KiB',
    `memory_usage_absolute.used_memory` UInt64 COMMENT 'used memory by the application, in KiB',
    `memory_usage_absolute.interval` UInt64 COMMENT 'interval between two consecutive readings',
    `low_memory.java_max_heap` UInt64 COMMENT 'maximum size of the java heap allocated, in kb' CODEC(T64, ZSTD(3)),
    `low_memory.java_total_heap` UInt64 COMMENT 'total size of the java heap available for allocation, in kb' CODEC(T64, ZSTD(3)),
    `low_memory.java_free_heap` UInt64 COMMENT 'free memory available in the java heap, in kb' CODEC(T64, ZSTD(3)),
    `low_memory.total_pss` UInt64 COMMENT 'total proportional set size - amount of memory used by the process, including shared memory and code. in kb.' CODEC(T64, ZSTD(3)),
    `low_memory.rss` UInt64 COMMENT 'resident set size - amount of physical memory currently used, in kb' CODEC(T64, ZSTD(3)),
    `low_memory.native_total_heap` UInt64 COMMENT 'total size of the native heap (memory out of java' CODEC(T64, ZSTD(3)),
    `low_memory.native_free_heap` UInt64 COMMENT 'amount of free memory available in the native heap, in kb' CODEC(T64, ZSTD(3)),
    `trim_memory.level` LowCardinality(FixedString(64)) COMMENT 'one of the trim memory constants as received by component callback' CODEC(ZSTD(3)),
    `cpu_usage.num_cores` UInt8 COMMENT 'number of cores on the device' CODEC(T64, ZSTD(3)),
    `cpu_usage.clock_speed` UInt32 COMMENT 'clock speed of the processor, in hz' CODEC(T64, ZSTD(3)),
    `cpu_usage.start_time` UInt64 COMMENT 'process start time, in jiffies' CODEC(T64, ZSTD(3)),
    `cpu_usage.uptime` UInt64 COMMENT 'time since the device booted, in msec' CODEC(T64, ZSTD(3)),
    `cpu_usage.utime` UInt64 COMMENT 'execution time in user mode, in jiffies' CODEC(T64, ZSTD(3)),
    `cpu_usage.cutime` UInt64 COMMENT 'execution time in user mode with child processes, in jiffies' CODEC(T64, ZSTD(3)),
    `cpu_usage.stime` UInt64 COMMENT 'execution time in kernel mode, in jiffies' CODEC(T64, ZSTD(3)),
    `cpu_usage.cstime` UInt64 COMMENT 'execution time in user mode with child processes, in jiffies' CODEC(T64, ZSTD(3)),
    `cpu_usage.interval` UInt64 COMMENT 'interval between two consecutive readings, in msec' CODEC(T64, ZSTD(3)),
    `cpu_usage.percentage_usage` Float64 COMMENT 'percentage of cpu usage in the interval' CODEC(DoubleDelta, ZSTD(3)),
    `navigation.to` FixedString(128) COMMENT 'destination page or screen where the navigation led to' CODEC(ZSTD(3)),
    `navigation.from` FixedString(128) COMMENT 'source page or screen from where the navigation was triggered' CODEC(ZSTD(3)),
    `navigation.source` FixedString(128) COMMENT 'how the event was collected example a library or framework name' CODEC(ZSTD(3)),
    `screen_view.name` FixedString(128) COMMENT 'name of the screen viewed' CODEC(ZSTD(3)),
    `bug_report.description` String COMMENT 'description of the bug report',
    `custom.name` LowCardinality(FixedString(64)) COMMENT 'name of the custom event',
    `attachments` String COMMENT 'attachment metadata' CODEC(ZSTD(3)),
    INDEX attribute_app_version_idx `attribute.app_version` TYPE minmax GRANULARITY 2,
    INDEX type_idx type TYPE set(100) GRANULARITY 2,
    INDEX exception_handled_idx `exception.handled` TYPE minmax GRANULARITY 2,
    INDEX attribute_os_name_idx `attribute.os_name` TYPE minmax GRANULARITY 2,
    INDEX attribute_os_version_idx `attribute.os_version` TYPE minmax GRANULARITY 2,
    INDEX inet_country_code_idx `inet.country_code` TYPE minmax GRANULARITY 2,
    INDEX attribute_device_name_idx `attribute.device_name` TYPE minmax GRANULARITY 2,
    INDEX attribute_device_manufacturer_idx `attribute.device_manufacturer` TYPE minmax GRANULARITY 2,
    INDEX attribute_device_locale_idx `attribute.device_locale` TYPE minmax GRANULARITY 2,
    INDEX attribute_network_provider_idx `attribute.network_provider` TYPE minmax GRANULARITY 2,
    INDEX attribute_network_type_idx `attribute.network_type` TYPE minmax GRANULARITY 2,
    INDEX exception_fingerprint_bloom_idx `exception.fingerprint` TYPE bloom_filter GRANULARITY 4,
    INDEX anr_fingerprint_bloom_idx `anr.fingerprint` TYPE bloom_filter GRANULARITY 4,
    INDEX user_defined_attribute_key_bloom_idx mapKeys(user_defined_attribute) TYPE bloom_filter(0.01) GRANULARITY 16,
    INDEX user_defined_attribute_key_minmax_idx mapKeys(user_defined_attribute) TYPE minmax GRANULARITY 16,
    INDEX custom_name_bloom_idx `custom.name` TYPE bloom_filter GRANULARITY 2
)
ENGINE = MergeTree
PRIMARY KEY (app_id, session_id, id)
ORDER BY (app_id, session_id, id, timestamp)
SETTINGS index_granularity = 8192
COMMENT 'events master table';

CREATE TABLE default.schema_migrations
(
    `version` String,
    `ts` DateTime DEFAULT now(),
    `applied` UInt8 DEFAULT 1
)
ENGINE = ReplacingMergeTree(ts)
PRIMARY KEY version
ORDER BY version
SETTINGS index_granularity = 8192;

CREATE TABLE default.sessions
(
    `app_id` UUID COMMENT 'unique id of th app' CODEC(ZSTD(3)),
    `session_id` UUID COMMENT 'session id' CODEC(ZSTD(3)),
    `first_event_timestamp` DateTime64(9, 'UTC') COMMENT 'timestamp of the first event' CODEC(DoubleDelta, ZSTD(3)),
    `last_event_timestamp` DateTime64(9, 'UTC') COMMENT 'timestamp of the last event' CODEC(DoubleDelta, ZSTD(3)),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite app version' CODEC(ZSTD(3)),
    `os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite os version' CODEC(ZSTD(3)),
    `country_code` LowCardinality(String) COMMENT 'country code' CODEC(ZSTD(3)),
    `network_provider` LowCardinality(String) COMMENT 'name of the network service provider' CODEC(ZSTD(3)),
    `network_type` LowCardinality(String) COMMENT 'wifi, cellular, vpn and so on' CODEC(ZSTD(3)),
    `network_generation` LowCardinality(String) COMMENT '2g, 3g, 4g and so on' CODEC(ZSTD(3)),
    `device_locale` LowCardinality(String) COMMENT 'rfc 5646 locale string' CODEC(ZSTD(3)),
    `device_manufacturer` LowCardinality(String) COMMENT 'manufacturer of the device' CODEC(ZSTD(3)),
    `device_name` LowCardinality(String) COMMENT 'name of the device' CODEC(ZSTD(3)),
    `device_model` LowCardinality(String) COMMENT 'model of the device' CODEC(ZSTD(3)),
    `user_id` LowCardinality(String) COMMENT 'attributed user id' CODEC(ZSTD(3)),
    `unique_types` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) COMMENT 'list of unique event type' CODEC(ZSTD(3)),
    `unique_strings` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) COMMENT 'list of unique log string values' CODEC(ZSTD(3)),
    `unique_view_classnames` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) COMMENT 'list of unique view class names' CODEC(ZSTD(3)),
    `unique_subview_classnames` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) COMMENT 'list of unique subview class names' CODEC(ZSTD(3)),
    `unique_exceptions` SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(
        type String,
        message String,
        file_name String,
        class_name String,
        method_name String))) COMMENT 'list of unique tuples of exception type and message' CODEC(ZSTD(3)),
    `unique_anrs` SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(
        type String,
        message String,
        file_name String,
        class_name String,
        method_name String))) COMMENT 'list of unique tuples of anr type and message' CODEC(ZSTD(3)),
    `unique_click_targets` SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(
        String,
        String))) COMMENT 'list of unique tuples of click targets and ids' CODEC(ZSTD(3)),
    `unique_longclick_targets` SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(
        String,
        String))) COMMENT 'list of unique tuples of long click targets and ids' CODEC(ZSTD(3)),
    `unique_scroll_targets` SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(
        String,
        String))) COMMENT 'list of unique tuples of scroll targets and ids' CODEC(ZSTD(3)),
    `event_count` AggregateFunction(uniq, UUID) COMMENT 'unique count of events in this session' CODEC(ZSTD(3)),
    `crash_count` AggregateFunction(uniq, UUID) COMMENT 'unique count of crash events in this session' CODEC(ZSTD(3)),
    `anr_count` AggregateFunction(uniq, UUID) COMMENT 'unique count of ANR events in this session' CODEC(ZSTD(3)),
    INDEX first_event_timestamp_minmax_idx first_event_timestamp TYPE minmax GRANULARITY 4,
    INDEX last_event_timestamp_minmax_idx last_event_timestamp TYPE minmax GRANULARITY 4,
    INDEX user_id_bloom_idx user_id TYPE bloom_filter GRANULARITY 2
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(first_event_timestamp)
ORDER BY (app_id, session_id, first_event_timestamp, app_version, os_version)
SETTINGS index_granularity = 8192
COMMENT 'aggregated app sessions';

CREATE MATERIALIZED VIEW default.sessions_mv TO default.sessions
(
    `session_id` UUID,
    `app_id` UUID,
    `first_event_timestamp` DateTime64(9, 'UTC'),
    `last_event_timestamp` DateTime64(9, 'UTC'),
    `app_version` Tuple(
        String,
        String),
    `os_version` Tuple(
        String,
        String),
    `country_code` String,
    `network_provider` String,
    `network_type` String,
    `network_generation` String,
    `device_locale` String,
    `device_manufacturer` String,
    `device_name` String,
    `device_model` String,
    `user_id` String,
    `unique_types` SimpleAggregateFunction(groupUniqArrayArray(10), Array(String)),
    `unique_strings` SimpleAggregateFunction(groupUniqArrayArray(10), Array(String)),
    `unique_view_classnames` SimpleAggregateFunction(groupUniqArrayArray(10), Array(String)),
    `unique_subview_classnames` SimpleAggregateFunction(groupUniqArrayArray(10), Array(String)),
    `unique_exceptions` SimpleAggregateFunction(groupUniqArrayArray(5), Array(Tuple(
        String,
        String,
        String,
        String,
        String))),
    `unique_anrs` SimpleAggregateFunction(groupUniqArrayArray(5), Array(Tuple(
        String,
        String,
        String,
        String,
        String))),
    `unique_click_targets` SimpleAggregateFunction(groupUniqArrayArray(5), Array(Tuple(
        String,
        String))),
    `unique_longclick_targets` SimpleAggregateFunction(groupUniqArrayArray(5), Array(Tuple(
        String,
        String))),
    `unique_scroll_targets` SimpleAggregateFunction(groupUniqArrayArray(5), Array(Tuple(
        String,
        String))),
    `event_count` AggregateFunction(uniq, UUID),
    `crash_count` AggregateFunction(uniq, UUID),
    `anr_count` AggregateFunction(uniq, UUID)
)
AS SELECT DISTINCT
    session_id,
    app_id,
    min(timestamp) AS first_event_timestamp,
    max(timestamp) AS last_event_timestamp,
    any((toString(attribute.app_version), toString(attribute.app_build))) AS app_version,
    any((toString(attribute.os_name), toString(attribute.os_version))) AS os_version,
    any(toString(inet.country_code)) AS country_code,
    any(toString(attribute.network_provider)) AS network_provider,
    any(toString(attribute.network_type)) AS network_type,
    any(toString(attribute.network_generation)) AS network_generation,
    any(toString(attribute.device_locale)) AS device_locale,
    any(toString(attribute.device_manufacturer)) AS device_manufacturer,
    any(toString(attribute.device_name)) AS device_name,
    any(toString(attribute.device_model)) AS device_model,
    any(toString(attribute.user_id)) AS user_id,
    groupUniqArrayArraySimpleState(10)([toString(type)]) AS unique_types,
    groupUniqArrayArraySimpleState(10)([toString(string.string)]) AS unique_strings,
    groupUniqArrayArraySimpleStateIf(10)([toString(lifecycle_activity.class_name)], (type = 'lifecycle_activity') AND (lifecycle_activity.class_name != '')) AS unique_view_classnames,
    groupUniqArrayArraySimpleStateIf(10)([toString(lifecycle_fragment.class_name)], (type = 'lifecycle_fragment') AND (lifecycle_fragment.class_name != '')) AS unique_subview_classnames,
    groupUniqArrayArraySimpleStateIf(5)([(simpleJSONExtractString(exception.exceptions, 'type'), simpleJSONExtractString(exception.exceptions, 'message'), simpleJSONExtractString(exception.exceptions, 'file_name'), simpleJSONExtractString(exception.exceptions, 'class_name'), simpleJSONExtractString(exception.exceptions, 'method_name'))], (type = 'exception') AND (exception.handled = false)) AS unique_exceptions,
    groupUniqArrayArraySimpleStateIf(5)([(simpleJSONExtractString(anr.exceptions, 'type'), simpleJSONExtractString(anr.exceptions, 'message'), simpleJSONExtractString(anr.exceptions, 'file_name'), simpleJSONExtractString(anr.exceptions, 'class_name'), simpleJSONExtractString(anr.exceptions, 'method_name'))], type = 'anr') AS unique_anrs,
    groupUniqArrayArraySimpleStateIf(5)([(toString(gesture_click.target), toString(gesture_click.target_id))], type = 'gesture_click') AS unique_click_targets,
    groupUniqArrayArraySimpleStateIf(5)([(toString(gesture_long_click.target), toString(gesture_long_click.target_id))], type = 'gesture_long_click') AS unique_longclick_targets,
    groupUniqArrayArraySimpleStateIf(5)([(toString(gesture_scroll.target), toString(gesture_scroll.target_id))], type = 'gesture_scroll') AS unique_scroll_targets,
    uniqState(id) AS event_count,
    uniqStateIf(id, (type = 'exception') AND (exception.handled = false)) AS crash_count,
    uniqStateIf(id, type = 'anr') AS anr_count
FROM default.events
GROUP BY
    app_id,
    session_id
ORDER BY
    app_id ASC,
    session_id ASC,
    first_event_timestamp ASC,
    app_version ASC,
    os_version ASC;

CREATE TABLE default.span_filters
(
    `app_id` UUID COMMENT 'associated app id' CODEC(LZ4),
    `end_of_month` DateTime COMMENT 'last day of the month' CODEC(DoubleDelta, ZSTD(3)),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite app version' CODEC(ZSTD(3)),
    `os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite os version' CODEC(ZSTD(3)),
    `country_code` LowCardinality(String) COMMENT 'country code' CODEC(ZSTD(3)),
    `network_provider` LowCardinality(String) COMMENT 'network provider' CODEC(ZSTD(3)),
    `network_type` LowCardinality(String) COMMENT 'network type' CODEC(ZSTD(3)),
    `network_generation` LowCardinality(String) COMMENT 'network generation' CODEC(ZSTD(3)),
    `device_locale` LowCardinality(String) COMMENT 'device locale' CODEC(ZSTD(3)),
    `device_manufacturer` LowCardinality(String) COMMENT 'device manufacturer' CODEC(ZSTD(3)),
    `device_name` LowCardinality(String) COMMENT 'device name' CODEC(ZSTD(3))
)
ENGINE = ReplacingMergeTree
ORDER BY (app_id, end_of_month, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name)
SETTINGS index_granularity = 8192
COMMENT 'derived span filters';

CREATE MATERIALIZED VIEW default.span_filters_mv TO default.span_filters
(
    `app_id` UUID,
    `end_of_month` Date,
    `app_version` String,
    `os_version` String,
    `country_code` LowCardinality(String),
    `network_provider` LowCardinality(String),
    `network_type` LowCardinality(String),
    `network_generation` LowCardinality(String),
    `device_locale` LowCardinality(String),
    `device_manufacturer` LowCardinality(String),
    `device_name` LowCardinality(String)
)
AS SELECT DISTINCT
    app_id,
    toLastDayOfMonth(start_time) AS end_of_month,
    toString(attribute.app_version) AS app_version,
    toString(attribute.os_version) AS os_version,
    toString(attribute.country_code) AS country_code,
    toString(attribute.network_provider) AS network_provider,
    toString(attribute.network_type) AS network_type,
    toString(attribute.network_generation) AS network_generation,
    toString(attribute.device_locale) AS device_locale,
    toString(attribute.device_manufacturer) AS device_manufacturer,
    toString(attribute.device_name) AS device_name
FROM default.spans
WHERE (toString(attribute.os_version) != '') AND (toString(attribute.country_code) != '') AND (toString(attribute.network_provider) != '') AND (toString(attribute.network_type) != '') AND (toString(attribute.network_generation) != '') AND (toString(attribute.device_locale) != '') AND (toString(attribute.device_manufacturer) != '') AND (toString(attribute.device_name) != '')
GROUP BY
    app_id,
    end_of_month,
    attribute.app_version,
    attribute.os_version,
    attribute.country_code,
    attribute.network_provider,
    attribute.network_type,
    attribute.network_generation,
    attribute.device_locale,
    attribute.device_manufacturer,
    attribute.device_name
ORDER BY app_id ASC;

CREATE TABLE default.span_metrics
(
    `app_id` UUID COMMENT 'associated app id' CODEC(ZSTD(3)),
    `span_name` LowCardinality(FixedString(128)) COMMENT 'name of the span' CODEC(ZSTD(3)),
    `span_id` FixedString(16) COMMENT 'id of the span' CODEC(ZSTD(3)),
    `status` UInt8 COMMENT 'status of the span 0 (Unset), 1 (Ok) or 2 (Error)' CODEC(ZSTD(3)),
    `timestamp` DateTime64(3, 'UTC') COMMENT 'interval metrics will be aggregated to' CODEC(DoubleDelta, ZSTD(3)),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite app version' CODEC(ZSTD(3)),
    `os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite os version' CODEC(ZSTD(3)),
    `country_code` LowCardinality(String) COMMENT 'country code' CODEC(ZSTD(3)),
    `network_provider` LowCardinality(String) COMMENT 'network provider' CODEC(ZSTD(3)),
    `network_type` LowCardinality(String) COMMENT 'network type' CODEC(ZSTD(3)),
    `network_generation` LowCardinality(String) COMMENT 'network generation' CODEC(ZSTD(3)),
    `device_locale` LowCardinality(String) COMMENT 'device locale' CODEC(ZSTD(3)),
    `device_manufacturer` LowCardinality(String) COMMENT 'device manufacturer' CODEC(ZSTD(3)),
    `device_name` LowCardinality(String) COMMENT 'device name' CODEC(ZSTD(3)),
    `device_low_power_mode` Bool COMMENT 'true if device is in power saving mode' CODEC(ZSTD(3)),
    `device_thermal_throttling_enabled` Bool COMMENT 'true if device is has thermal throttling enabled' CODEC(ZSTD(3)),
    `p50` AggregateFunction(quantile(0.5), Int64) COMMENT 'p50 quantile of span duration' CODEC(ZSTD(3)),
    `p90` AggregateFunction(quantile(0.9), Int64) COMMENT 'p90 quantile of span duration' CODEC(ZSTD(3)),
    `p95` AggregateFunction(quantile(0.95), Int64) COMMENT 'p95 quantile of span duration' CODEC(ZSTD(3)),
    `p99` AggregateFunction(quantile(0.5), Int64) COMMENT 'p99 quantile of span duration' CODEC(ZSTD(3))
)
ENGINE = AggregatingMergeTree
ORDER BY (app_id, span_name, span_id, timestamp, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name)
SETTINGS index_granularity = 8192
COMMENT 'aggregated span metrics by a fixed time window';

CREATE MATERIALIZED VIEW default.span_metrics_mv TO default.span_metrics
(
    `app_id` UUID,
    `span_name` LowCardinality(FixedString(64)),
    `span_id` FixedString(16),
    `status` UInt8,
    `timestamp` DateTime('UTC'),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)),
    `os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)),
    `country_code` LowCardinality(String),
    `network_provider` LowCardinality(String),
    `network_type` LowCardinality(String),
    `network_generation` LowCardinality(String),
    `device_locale` LowCardinality(String),
    `device_manufacturer` LowCardinality(String),
    `device_name` LowCardinality(String),
    `device_low_power_mode` Bool,
    `device_thermal_throttling_enabled` Bool,
    `p50` AggregateFunction(quantile(0.5), Int64),
    `p90` AggregateFunction(quantile(0.9), Int64),
    `p95` AggregateFunction(quantile(0.95), Int64),
    `p99` AggregateFunction(quantile(0.99), Int64)
)
AS SELECT
    app_id,
    span_name,
    span_id,
    status,
    toStartOfFifteenMinutes(start_time) AS timestamp,
    attribute.app_version AS app_version,
    attribute.os_version AS os_version,
    attribute.country_code AS country_code,
    attribute.network_provider AS network_provider,
    attribute.network_type AS network_type,
    attribute.network_generation AS network_generation,
    attribute.device_locale AS device_locale,
    attribute.device_manufacturer AS device_manufacturer,
    attribute.device_name AS device_name,
    attribute.device_low_power_mode AS device_low_power_mode,
    attribute.device_thermal_throttling_enabled AS device_thermal_throttling_enabled,
    quantileState(0.5)(dateDiff('ms', start_time, end_time)) AS p50,
    quantileState(0.9)(dateDiff('ms', start_time, end_time)) AS p90,
    quantileState(0.95)(dateDiff('ms', start_time, end_time)) AS p95,
    quantileState(0.99)(dateDiff('ms', start_time, end_time)) AS p99
FROM default.spans
GROUP BY
    app_id,
    span_name,
    span_id,
    status,
    timestamp,
    app_version,
    os_version,
    country_code,
    network_provider,
    network_type,
    network_generation,
    device_locale,
    device_manufacturer,
    device_name,
    device_low_power_mode,
    device_thermal_throttling_enabled
ORDER BY
    app_id ASC,
    span_name ASC,
    span_id ASC,
    status ASC,
    timestamp ASC,
    app_version ASC,
    os_version ASC,
    country_code ASC,
    network_provider ASC,
    network_type ASC,
    network_generation ASC,
    device_locale ASC,
    device_manufacturer ASC,
    device_name ASC,
    device_low_power_mode ASC,
    device_thermal_throttling_enabled ASC;

CREATE TABLE default.span_user_def_attrs
(
    `app_id` UUID COMMENT 'associated app id' CODEC(LZ4),
    `span_id` FixedString(16) COMMENT 'id of the span' CODEC(ZSTD(3)),
    `session_id` UUID COMMENT 'id of the session' CODEC(LZ4),
    `end_of_month` DateTime COMMENT 'last day of the month' CODEC(DoubleDelta, ZSTD(3)),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite app version' CODEC(ZSTD(3)),
    `os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite os version' CODEC(ZSTD(3)),
    `key` LowCardinality(String) COMMENT 'key of the user defined attribute' CODEC(ZSTD(3)),
    `type` Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4) COMMENT 'type of the user defined attribute' CODEC(ZSTD(3)),
    `value` String COMMENT 'value of the user defined attribute' CODEC(ZSTD(3)),
    INDEX end_of_month_minmax_idx end_of_month TYPE minmax GRANULARITY 2,
    INDEX key_bloom_idx key TYPE bloom_filter(0.05) GRANULARITY 1,
    INDEX key_set_idx key TYPE set(1000) GRANULARITY 2,
    INDEX session_bloom_idx session_id TYPE bloom_filter GRANULARITY 2
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(end_of_month)
ORDER BY (app_id, end_of_month, app_version, os_version, key, type, value, span_id, session_id)
SETTINGS index_granularity = 8192
COMMENT 'derived span user defined attributes';

CREATE MATERIALIZED VIEW default.span_user_def_attrs_mv TO default.span_user_def_attrs
(
    `app_id` UUID,
    `span_id` FixedString(16),
    `session_id` UUID,
    `end_of_month` Date,
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)),
    `os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)),
    `key` LowCardinality(String),
    `type` Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4),
    `value` String
)
AS SELECT DISTINCT
    app_id,
    span_id,
    session_id,
    toLastDayOfMonth(start_time) AS end_of_month,
    attribute.app_version AS app_version,
    attribute.os_version AS os_version,
    arr_key AS key,
    arr_val.1 AS type,
    arr_val.2 AS value
FROM default.spans
ARRAY JOIN
    mapKeys(user_defined_attribute) AS arr_key,
    mapValues(user_defined_attribute) AS arr_val
WHERE length(user_defined_attribute) > 0
GROUP BY
    app_id,
    end_of_month,
    app_version,
    os_version,
    key,
    type,
    value,
    span_id,
    session_id
ORDER BY app_id ASC;

CREATE TABLE default.spans
(
    `app_id` UUID COMMENT 'unique id of the app' CODEC(ZSTD(3)),
    `span_name` LowCardinality(FixedString(64)) COMMENT 'name of the span' CODEC(ZSTD(3)),
    `span_id` FixedString(16) COMMENT 'id of the span' CODEC(ZSTD(3)),
    `parent_id` FixedString(16) COMMENT 'id of the parent span' CODEC(ZSTD(3)),
    `trace_id` FixedString(32) COMMENT 'id of the trace' CODEC(ZSTD(3)),
    `session_id` UUID COMMENT 'session id' CODEC(ZSTD(3)),
    `status` UInt8 COMMENT 'status of the span 0 (Unset), 1 (Ok) or 2 (Error)' CODEC(ZSTD(3)),
    `start_time` DateTime64(9, 'UTC') COMMENT 'start time' CODEC(DoubleDelta, ZSTD(3)),
    `end_time` DateTime64(9, 'UTC') COMMENT 'end time' CODEC(DoubleDelta, ZSTD(3)),
    `checkpoints` Array(Tuple(
        FixedString(64),
        DateTime64(9, 'UTC'))) COMMENT 'array of checkpoints - {name, timestamp}' CODEC(ZSTD(3)),
    `attribute.app_unique_id` LowCardinality(FixedString(128)) COMMENT 'app bundle identifier' CODEC(ZSTD(3)),
    `attribute.installation_id` UUID COMMENT 'unique id for an installation of an app, generated by sdk' CODEC(ZSTD(3)),
    `attribute.user_id` LowCardinality(String) COMMENT 'attributed user id' CODEC(ZSTD(3)),
    `attribute.measure_sdk_version` LowCardinality(FixedString(16)) COMMENT 'measure sdk version identifier' CODEC(ZSTD(3)),
    `attribute.app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite app version' CODEC(ZSTD(3)),
    `attribute.os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite os version' CODEC(ZSTD(3)),
    `attribute.platform` LowCardinality(FixedString(32)) COMMENT 'platform identifier' CODEC(ZSTD(3)),
    `attribute.thread_name` FixedString(64) COMMENT 'thread on which the span was captured' CODEC(ZSTD(3)),
    `attribute.country_code` LowCardinality(String) COMMENT 'country code' CODEC(ZSTD(3)),
    `attribute.network_provider` LowCardinality(String) COMMENT 'name of the network service provider' CODEC(ZSTD(3)),
    `attribute.network_type` LowCardinality(String) COMMENT 'wifi, cellular, vpn and so on' CODEC(ZSTD(3)),
    `attribute.network_generation` LowCardinality(String) COMMENT '2g, 3g, 4g and so on' CODEC(ZSTD(3)),
    `attribute.device_name` LowCardinality(String) COMMENT 'name of the device' CODEC(ZSTD(3)),
    `attribute.device_model` LowCardinality(String) COMMENT 'model of the device' CODEC(ZSTD(3)),
    `attribute.device_manufacturer` LowCardinality(String) COMMENT 'manufacturer of the device' CODEC(ZSTD(3)),
    `attribute.device_locale` LowCardinality(String) COMMENT 'rfc 5646 locale string' CODEC(ZSTD(3)),
    `attribute.device_low_power_mode` Bool COMMENT 'true if device is in power saving mode' CODEC(ZSTD(3)),
    `attribute.device_thermal_throttling_enabled` Bool COMMENT 'true if device is has thermal throttling enabled' CODEC(ZSTD(3)),
    `user_defined_attribute` Map(LowCardinality(String), Tuple(
        Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4),
        String)) CODEC(ZSTD(3)),
    INDEX span_name_bloom_idx span_name TYPE bloom_filter GRANULARITY 2,
    INDEX span_id_bloom_idx span_id TYPE bloom_filter GRANULARITY 2,
    INDEX trace_id_bloom_idx trace_id TYPE bloom_filter GRANULARITY 2,
    INDEX parent_id_bloom_idx parent_id TYPE bloom_filter GRANULARITY 2,
    INDEX start_time_minmax_idx start_time TYPE minmax GRANULARITY 2,
    INDEX end_time_minmax_idx end_time TYPE minmax GRANULARITY 2,
    INDEX user_defined_attribute_key_bloom_idx mapKeys(user_defined_attribute) TYPE bloom_filter(0.01) GRANULARITY 16,
    INDEX user_defined_attribute_key_minmax_idx mapKeys(user_defined_attribute) TYPE minmax GRANULARITY 16
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(start_time)
ORDER BY (app_id, span_name, trace_id, span_id, start_time, end_time)
SETTINGS index_granularity = 8192
COMMENT 'spans table';

CREATE TABLE default.user_def_attrs
(
    `app_id` UUID COMMENT 'associated app id' CODEC(LZ4),
    `event_id` UUID COMMENT 'id of the event' CODEC(LZ4),
    `session_id` UUID COMMENT 'id of the session' CODEC(LZ4),
    `end_of_month` DateTime COMMENT 'last day of the month' CODEC(DoubleDelta, ZSTD(3)),
    `app_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite app version' CODEC(ZSTD(3)),
    `os_version` Tuple(
        LowCardinality(String),
        LowCardinality(String)) COMMENT 'composite os version' CODEC(ZSTD(3)),
    `exception` Bool COMMENT 'true if source is exception event' CODEC(ZSTD(3)),
    `anr` Bool COMMENT 'true if source is anr event' CODEC(ZSTD(3)),
    `key` LowCardinality(String) COMMENT 'key of the user defined attribute' CODEC(ZSTD(3)),
    `type` Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4) COMMENT 'type of the user defined attribute' CODEC(ZSTD(3)),
    `value` String COMMENT 'value of the user defined attribute' CODEC(ZSTD(3)),
    INDEX end_of_month_minmax_idx end_of_month TYPE minmax GRANULARITY 2,
    INDEX exception_bloom_idx exception TYPE bloom_filter GRANULARITY 2,
    INDEX anr_bloom_idx anr TYPE bloom_filter GRANULARITY 2,
    INDEX key_bloom_idx key TYPE bloom_filter(0.05) GRANULARITY 1,
    INDEX key_set_idx key TYPE set(1000) GRANULARITY 2,
    INDEX session_bloom_idx session_id TYPE bloom_filter GRANULARITY 2
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(end_of_month)
ORDER BY (app_id, end_of_month, app_version, os_version, exception, anr, key, type, value, event_id, session_id)
SETTINGS index_granularity = 8192
COMMENT 'derived user defined attributes';

CREATE MATERIALIZED VIEW default.user_def_attrs_mv TO default.user_def_attrs
(
    `app_id` UUID,
    `event_id` UUID,
    `session_id` UUID,
    `end_of_month` Date,
    `app_version` Tuple(
        LowCardinality(String),
        String),
    `os_version` Tuple(
        LowCardinality(String),
        String),
    `exception` Bool,
    `anr` Bool,
    `key` LowCardinality(String),
    `type` Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4),
    `value` String
)
AS SELECT DISTINCT
    app_id,
    id AS event_id,
    session_id,
    toLastDayOfMonth(timestamp) AS end_of_month,
    (toString(attribute.app_version), toString(attribute.app_build)) AS app_version,
    (toString(attribute.os_name), toString(attribute.os_version)) AS os_version,
    if((events.type = 'exception') AND (exception.handled = false), true, false) AS exception,
    if(events.type = 'anr', true, false) AS anr,
    arr_key AS key,
    arr_val.1 AS type,
    arr_val.2 AS value
FROM default.events
ARRAY JOIN
    mapKeys(user_defined_attribute) AS arr_key,
    mapValues(user_defined_attribute) AS arr_val
WHERE length(user_defined_attribute) > 0
GROUP BY
    app_id,
    end_of_month,
    app_version,
    os_version,
    events.type,
    exception.handled,
    key,
    type,
    value,
    event_id,
    session_id
ORDER BY app_id ASC;


--
-- Dbmate schema migrations
--

INSERT INTO schema_migrations (version) VALUES
    ('20231117020810'),
    ('20240905133723'),
    ('20240910123710'),
    ('20240911150110'),
    ('20240921130749'),
    ('20240921131206'),
    ('20240921131337'),
    ('20240921131410'),
    ('20241002055159'),
    ('20241015073422'),
    ('20241015075419'),
    ('20241023021807'),
    ('20241023053007'),
    ('20241023061713'),
    ('20241023223511'),
    ('20241026034532'),
    ('20241026035159'),
    ('20241031172411'),
    ('20241102085036'),
    ('20241102092836'),
    ('20241106132226'),
    ('20241107074128'),
    ('20241107074259'),
    ('20241112084744'),
    ('20241112203748'),
    ('20241113073411'),
    ('20241113110703'),
    ('20241114032215'),
    ('20241125094343'),
    ('20241125094539'),
    ('20241128084916'),
    ('20241128085921'),
    ('20241204135555'),
    ('20241210052709'),
    ('20250204070350'),
    ('20250204070357'),
    ('20250204070548'),
    ('20250210121718'),
    ('20250212094815'),
    ('20250212102310');
