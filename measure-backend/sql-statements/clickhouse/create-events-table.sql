/*
create events table
*/

create table if not exists events_test_1
(
    `id` UUID,
    `timestamp` DateTime64(9, 'UTC'),
    `severity_text` LowCardinality(FixedString(10)),
    `resource.session_id` UUID,
    `resource.device_name` FixedString(32),
    `resource.device_model` FixedString(32),
    `resource.device_manufacturer` FixedString(32),
    `resource.device_type` LowCardinality(FixedString(32)),
    `resource.device_is_foldable` Bool,
    `resource.device_is_physical` Bool,
    `resource.device_density_dpi` UInt16,
    `resource.device_width_px` UInt16,
    `resource.device_height_px` UInt16,
    `resource.device_density` UInt8,
    `resource.os_name` FixedString(32),
    `resource.os_version` FixedString(32),
    `resource.platform` LowCardinality(FixedString(32)),
    `resource.app_version` FixedString(32),
    `resource.app_build` FixedString(32),
    `resource.app_unique_id` FixedString(128),
    `resource.measure_sdk_version` FixedString(16),
    `body.type` LowCardinality(FixedString(32)),
    /* string */
    `body.string` String,
    /* exceptions */
    `body.exception.exceptions` String, /* should this be an Array type?? or perhaps store in a different table? */
    `body.exception.handled` Bool,
    /* gesture_long_click */
    `body.gesture_long_click.target` FixedString(128),
    `body.gesture_long_click.target_user_readable_name` FixedString(128),
    `body.gesture_long_click.target_id` FixedString(32),
    `body.gesture_long_click.touch_down_time` DateTime('UTC'),
    `body.gesture_long_click.touch_up_time` DateTime('UTC'),
    `body.gesture_long_click.width` UInt8,
    `body.gesture_long_click.height` UInt8,
    `body.gesture_long_click.x` UInt8,
    `body.gesture_long_click.y` UInt8,
    /* gesture_click */
    `body.gesture_click.target` FixedString(128),
    `body.gesture_click.target_user_readable_name` FixedString(128),
    `body.gesture_click.target_id` FixedString(128),
    `body.gesture_click.touch_down_time` DateTime('UTC'),
    `body.gesture_click.touch_up_time` DateTime('UTC'),
    `body.gesture_click.width` UInt16,
    `body.gesture_click.height` UInt16,
    `body.gesture_click.x` UInt16,
    `body.gesture_click.y` UInt16,
    /* gesture_scroll */
    `body.gesture_scroll.target` FixedString(128),
    `body.gesture_scroll.target_user_readable_name` FixedString(128),
    `body.gesture_scroll.target_id` FixedString(128),
    `body.gesture_scroll.touch_down_time` DateTime('UTC'),
    `body.gesture_scroll.touch_up_time` DateTime('UTC'),
    `body.gesture_scroll.x` UInt16,
    `body.gesture_scroll.y` UInt16,
    `body.gesture_scroll.end_x` UInt16,
    `body.gesture_scroll.end_y` UInt16,
    `body.gesture_scroll.velocity_px` UInt16,
    `body.gesture_scroll.angle` UInt16,
    /* http_request */
    `body.http_request.request_id` UUID,
    `body.http_request.request_url` String,
    `body.http_request.method` LowCardinality(FixedString(16)),
    `body.http_request.http_protocol_version` LowCardinality(FixedString(16)),
    `body.http_request.request_body_size` UInt32,
    `body.http_request.request_body` String,
    `body.http_request.request_headers` Map(String, String),
    /* http_response */
    `body.http_response.request_id` UUID,
    `body.http_response.request_url` String,
    `body.http_response.method` LowCardinality(FixedString(16)),
    `body.http_response.latency_ms` UInt16,
    `body.http_response.status_code` UInt16,
    `body.http_response.response_body` String,
    `body.http_response.response_headers` Map(String, String)

)
engine = MergeTree
primary key (id, timestamp)
