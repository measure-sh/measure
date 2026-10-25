-- migrate:up
create materialized view if not exists analytics_events_mv
to analytics_events
as select
  id,
  team_id,
  app_id,
  attribute.installation_id as installation_id,
  session_id,
  timestamp,
  inserted_at,
  type,
  multiIf(
    type = 'lifecycle_activity', lifecycle_activity.class_name,
    type = 'lifecycle_fragment', lifecycle_fragment.class_name,
    type = 'lifecycle_view_controller', lifecycle_view_controller.class_name,
    type = 'lifecycle_swift_ui', lifecycle_swift_ui.class_name,
    type = 'screen_view', screen_view.name,
    '') as `screen.name`,
  if(type = 'custom', toString(custom.name), '') as `custom.name`,
  multiIf(
    type = 'anr', toString(anr.fingerprint),
    type = 'app_hang', app_hang.fingerprint,
    type = 'exception', toString(exception.fingerprint),
    '') as `error.fingerprint`,
  multiIf(
    type in ('anr', 'app_hang'), 'fatal',
    type = 'exception' and (exception.severity = 'fatal' or (exception.severity = '' and exception.handled = false)), 'fatal',
    type = 'exception', 'nonfatal',
    '') as `error.severity`,
  if(type = 'app_hang', app_hang.state, '') as `app_hang.state`,
  if(type = 'http', http.method, '') as `http.method`,
  if(type = 'http', domain(http.url), '') as `http.domain`,
  if(type = 'http', path(http.url), '') as `http.path`,
  if(type = 'http', http.status_code, 0) as `http.status_code`,
  if(type = 'http' and http.end_time >= http.start_time, toUInt32(least(http.end_time - http.start_time, 4294967295)), 0) as `http.latency_ms`,
  `gesture_click.target`,
  `gesture_click.target_id`,
  `gesture_click.label`,
  `gesture_click.semantic_label`,
  `gesture_long_click.target`,
  `gesture_long_click.target_id`,
  `gesture_long_click.label`,
  `gesture_long_click.semantic_label`,
  `gesture_scroll.target`,
  `gesture_scroll.target_id`,
  `gesture_scroll.direction`,
  `lifecycle_app.type`,
  `cold_launch.launched_activity`,
  `cold_launch.intent_data`,
  `cold_launch.duration`,
  `warm_launch.launched_activity`,
  `warm_launch.intent_data`,
  `warm_launch.duration`,
  `hot_launch.launched_activity`,
  `hot_launch.intent_data`,
  `hot_launch.duration`,
  attribute.app_version,
  attribute.app_build,
  attribute.patch_version,
  attribute.patch_id,
  attribute.os_name,
  attribute.os_version,
  attribute.device_name,
  attribute.device_manufacturer,
  attribute.device_locale,
  attribute.network_type,
  attribute.network_generation,
  attribute.network_provider,
  attribute.user_id,
  inet.country_code,
  user_defined_attribute
from events
where (type = 'lifecycle_activity' and lifecycle_activity.type in ('created', 'resumed'))
      or (type = 'lifecycle_fragment' and lifecycle_fragment.type in ('attached', 'resumed'))
      or (type = 'lifecycle_view_controller' and lifecycle_view_controller.type in ('viewDidLoad', 'viewDidAppear'))
      or (type = 'lifecycle_swift_ui' and lifecycle_swift_ui.type = 'on_appear')
      or type = 'screen_view'
      or type = 'custom'
      or type = 'exception'
      or type = 'anr'
      or type = 'app_hang'
      or type = 'http'
      or type = 'gesture_click'
      or type = 'gesture_long_click'
      or type = 'gesture_scroll'
      or type = 'lifecycle_app'
      or type = 'cold_launch'
      or type = 'warm_launch'
      or type = 'hot_launch'
;

-- migrate:down
drop view if exists analytics_events_mv;
