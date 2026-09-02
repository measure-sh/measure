-- migrate:up
alter table journey_mv
modify query
select
  id,
  team_id,
  app_id,
  session_id,
  timestamp,
  inserted_at,
  type,
  (attribute.app_version, attribute.app_build) as app_version,
  attribute.patch_version as patch_version,
  attribute.patch_id as patch_id,
  exception.handled,
  exception.severity,
  exception.fingerprint,
  anr.fingerprint,
  lifecycle_activity.type,
  lifecycle_activity.class_name,
  lifecycle_fragment.type,
  lifecycle_fragment.class_name,
  lifecycle_fragment.parent_activity,
  lifecycle_fragment.parent_fragment,
  lifecycle_view_controller.type,
  lifecycle_view_controller.class_name,
  lifecycle_swift_ui.type,
  lifecycle_swift_ui.class_name,
  screen_view.name
from events
where type = 'lifecycle_activity'
      or type = 'lifecycle_fragment'
      or type = 'lifecycle_view_controller'
      or type = 'lifecycle_swift_ui'
      or type = 'screen_view'
      or type = 'exception'
      or type = 'anr'
;

-- migrate:down
alter table journey_mv
modify query
select
  id,
  team_id,
  app_id,
  session_id,
  timestamp,
  inserted_at,
  type,
  (attribute.app_version, attribute.app_build) as app_version,
  exception.handled,
  exception.severity,
  exception.fingerprint,
  anr.fingerprint,
  lifecycle_activity.type,
  lifecycle_activity.class_name,
  lifecycle_fragment.type,
  lifecycle_fragment.class_name,
  lifecycle_fragment.parent_activity,
  lifecycle_fragment.parent_fragment,
  lifecycle_view_controller.type,
  lifecycle_view_controller.class_name,
  lifecycle_swift_ui.type,
  lifecycle_swift_ui.class_name,
  screen_view.name
from events
where type = 'lifecycle_activity'
      or type = 'lifecycle_fragment'
      or type = 'lifecycle_view_controller'
      or type = 'lifecycle_swift_ui'
      or type = 'screen_view'
      or type = 'exception'
      or type = 'anr'
;
