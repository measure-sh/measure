/*
create events table
*/

create table if not exists events_test_2
(
    `id` UUID,
    `type` LowCardinality(FixedString(32)),
    `session_id` UUID,
    `timestamp` DateTime64(9, 'UTC'),
    `resource.device_name` FixedString(32),
    `resource.device_model` FixedString(32),
    `resource.device_manufacturer` FixedString(32),
    `resource.device_type` LowCardinality(FixedString(32)),
    `resource.device_is_foldable` Bool,
    `resource.device_is_physical` Bool,
    `resource.device_density_dpi` UInt16,
    `resource.device_width_px` UInt16,
    `resource.device_height_px` UInt16,
    `resource.device_density` Float32,
    `resource.os_name` FixedString(32),
    `resource.os_version` FixedString(32),
    `resource.platform` LowCardinality(FixedString(32)),
    `resource.app_version` FixedString(32),
    `resource.app_build` FixedString(32),
    `resource.app_unique_id` FixedString(128),
    `resource.measure_sdk_version` FixedString(16),
    /* anr */
    `anr.thread_name` LowCardinality(String),
    `anr.handled` Bool,
    /* delimits with underscore because clickhouse treats dot as a nested data structure and tries to match the length of exception.exceptions & exception.threads */
    `anr_exceptions` Array(Tuple(LowCardinality(String), LowCardinality(String), Array(Tuple(Int32, Int32, LowCardinality(String), LowCardinality(String), LowCardinality(String), LowCardinality(String))))),
    `anr_threads` Array(Tuple(LowCardinality(String), Array(Tuple(Int32, Int32, LowCardinality(String), LowCardinality(String), LowCardinality(String), LowCardinality(String))))),
    /* exceptions */
    `exception.thread_name` LowCardinality(String),
    `exception.handled` Bool,
    /* delimits with underscore because clickhouse treats dot as a nested data structure and tries to match the length of exception.exceptions & exception.threads */
    `exception_exceptions` Array(Tuple(LowCardinality(String), LowCardinality(String), Array(Tuple(Int32, Int32, LowCardinality(String), LowCardinality(String), LowCardinality(String), LowCardinality(String))))),
    `exception_threads` Array(Tuple(LowCardinality(String), Array(Tuple(Int32, Int32, LowCardinality(String), LowCardinality(String), LowCardinality(String), LowCardinality(String))))),
    /* app_exit */
    `app_exit.reason` LowCardinality(FixedString(64)),
    `app_exit.importance` LowCardinality(FixedString(32)),
    `app_exit.trace` String,
    `app_exit.process_name` String,
    `app_exit.pid` String,
    `app_exit.timestamp` DateTime64(9, 'UTC'),
    /* string */
    `string.severity_text` LowCardinality(FixedString(10)),
    `string.string` String,
    /* gesture_long_click */
    `gesture_long_click.target` FixedString(128),
    `gesture_long_click.target_id` FixedString(128),
    `gesture_long_click.touch_down_time` UInt32,
    `gesture_long_click.touch_up_time` UInt32,
    `gesture_long_click.width` UInt16,
    `gesture_long_click.height` UInt16,
    `gesture_long_click.x` Float32,
    `gesture_long_click.y` Float32,
    /* gesture_click */
    `gesture_click.target` FixedString(128),
    `gesture_click.target_id` FixedString(128),
    `gesture_click.touch_down_time` UInt32,
    `gesture_click.touch_up_time` UInt32,
    `gesture_click.width` UInt16,
    `gesture_click.height` UInt16,
    `gesture_click.x` Float32,
    `gesture_click.y` Float32,
    /* gesture_scroll */
    `gesture_scroll.target` FixedString(128),
    `gesture_scroll.target_id` FixedString(128),
    `gesture_scroll.touch_down_time` UInt32,
    `gesture_scroll.touch_up_time` UInt32,
    `gesture_scroll.x` Float32,
    `gesture_scroll.y` Float32,
    `gesture_scroll.end_x` Float32,
    `gesture_scroll.end_y` Float32,
    `gesture_scroll.direction` FixedString(8),
    /* http_request */
    `http_request.request_id` UUID,
    `http_request.request_url` String,
    `http_request.method` LowCardinality(FixedString(16)),
    `http_request.http_protocol_version` LowCardinality(FixedString(16)),
    `http_request.request_body_size` UInt32,
    `http_request.request_body` String,
    `http_request.request_headers` Map(String, String),
    /* http_response */
    `http_response.request_id` UUID,
    `http_response.request_url` String,
    `http_response.method` LowCardinality(FixedString(16)),
    `http_response.latency_ms` UInt16,
    `http_response.status_code` UInt16,
    `http_response.response_body` String,
    `http_response.response_headers` Map(String, String),
    /* lifecycle_activity */
    `lifecycle_activity.type` FixedString(32),
    `lifecycle_activity.class_name` FixedString(128),
    `lifecycle_activity.intent` String,
    `lifecycle_activity.saved_instance_state` Bool,
    /* lifecycle_fragment */
    `lifecycle_fragment.type` FixedString(32),
    `lifecycle_fragment.class_name` FixedString(128),
    `lifecycle_fragment.parent_activity` String,
    `lifecycle_fragment.tag` String,
    /* lifecycle_app */
    `lifecycle_app.type` FixedString(32),
    /* attributes */
    `attributes` Map(String, String)
)
engine = MergeTree
primary key (id, timestamp)
