-- use this file to write and test draft queries
/*
create events table
*/

create table if not exists events
(
    `id` UUID,
    `timestamp` DateTime64(9, 'UTC'),
    `resource.session_id` UUID,
    `resource.device_name` FixedString(32),
    `resource.device_model` FixedString(32),
    `resource.device_manufacturer` FixedString(32),
    `resource.device_type` LowCardinality(FixedString(32)),
    `resource.device_is_foldable` Bool,
    `resource.device_is_physical` Bool,
    `resource.device_density_dpi` UInt8,
    `resource.device_width_px` UInt8,
    `resource.device_height_px` UInt8,
    `resource.device_density` UInt8,
    `resource.os_name` FixedString(32),
    `resource.os_version` FixedString(32),
    `resource.platform` LowCardinality(FixedString(32)),
    `resource.app_version` FixedString(32),
    `resource.app_build` FixedString(32),
    `resource.app_unique_id` FixedString(128),
    `resource.app_first_install_time` DateTime('UTC'),
    `resource.app_last_update_time` DateTime('UTC'),
    `resource.measure_sdk_version` FixedString(16),
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
    `body.gesture_scroll.velocity_px` UInt16,
    `body.gesture_scroll.direction` UInt16,
    /* http_request */
    `body.http_request.id` UUID,
    `body.http_request.url` String,
    `body.http_request.method` LowCardinality(FixedString(16)),
    `body.http_request.content_type` FixedString(128),
    /* `body.http_request.network_transport` FixedString(32), */
    `body.http_request.user_agent` FixedString(128), /* should appear as part of the headers */
    `body.http_request.protocol_version` LowCardinality(FixedString(16)),
    `body.http_request.body_size` UInt32,
    `body.http_request.body` String,
    `body.http_request.headers` Map(String, String),
    /* http_response */
    `body.http_response.request_id` UUID,
    `body.http_response.request_url` String,
    `body.http_response.method` LowCardinality(FixedString(16)),
    `body.http_response.content_type` FixedString(128),
    `body.http_response.status_code` UInt16,
    `body.http_response.body` String,
    `body.http_response.headers` Map(String, String)

)
engine = MergeTree
primary key (id, timestamp)


/*
insert sample data to events table
*/

insert into events (id, session_id, timestamp, type, resource.device_name, resource.device_model) values

    (toUUID('a922b7d5-b53a-41f9-ae29-6bb17abca34d'), toUUID('025d8f63-9985-4325-a085-617c6b29fabb'), now(), 'exception', 'samsung', 's23'),
    (toUUID('214f6409-fb1c-4503-b2ab-abd05af33a0a'), toUUID('025d8f63-9985-4325-a085-617c6b29fabb'), now() + 20, 'exception', 'samsung', 's23'),
    (toUUID('846eb14d-a3a1-4908-bfb5-5da7a5279dca'), toUUID('025d8f63-9985-4325-a085-617c6b29fabb'), now() + 25, 'exception', 'samsung', 's23'),
    (toUUID('524bff3c-3691-42a5-b94b-c883ffd6fbf0'), toUUID('3121bcf9-5708-4572-a2a7-7087844f65fe'), now() + 10, 'exception', 'apple', 'iphone 14'),
    (toUUID('f3813b3b-d7ad-4dee-96c0-d241cc00dd74'), toUUID('3121bcf9-5708-4572-a2a7-7087844f65fe'), now() + 26, 'exception', 'apple', 'iphone 14'),
    (toUUID('8507c8e1-bb93-4052-a5f7-642e1c051322'), toUUID('3121bcf9-5708-4572-a2a7-7087844f65fe'), now() + 28, 'exception', 'apple', 'iphone 14'),
    (toUUID('71a4ff5d-a767-420e-b1fe-1fc57eabb81d'), toUUID('49b52292-06c0-498c-8686-b4c92dce0bd2'), today(), 'exception', 'samsung', 'galaxy s');

insert into events (id, session_id, timestamp, type, resource.device_name, resource.device_model) values

    (toUUID('8e64877b-7a6d-409b-b608-55bd520cc11e'), toUUID('025d8f63-9985-4325-a085-617c6b29fabb'), now(), 'anr', 'samsung', 's23');


/*
delete rows from a table
*/

delete from events where type='anr';
delete from events where id='a922b7d5-b53a-41f9-ae29-6bb17abca34d';

/*
add new column
*/

alter table events add column if not exists `resource.device_manufacturer` FixedString(32) after `resource.device_model`;


/*
insert with device_manufacturer
*/
insert into events (id, session_id, timestamp, type, resource.device_name, resource.device_model, resource.device_manufacturer) values

    (toUUID('8e64877b-7a6d-409b-b608-55bd520cc11e'), toUUID('025d8f63-9985-4325-a085-617c6b29fabb'), now(), 'anr', 'samsung', 's23', 'samsung');