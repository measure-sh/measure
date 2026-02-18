-- migrate:up
create materialized view if not exists journey_mv
to journey
as select
  id,
  team_id,
  app_id,
  session_id,
  timestamp,
  inserted_at,
  type,
  (attribute.app_version, attribute.app_build) as app_version,
  exception.handled,
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
drop table if exists journey_mv;
