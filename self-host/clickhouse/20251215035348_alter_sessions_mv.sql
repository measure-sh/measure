-- migrate:up
alter table sessions_mv modify query
 SELECT
  team_id,
  app_id,
  session_id,
  min(timestamp) AS first_event_timestamp, -- need this because this column is used to partition table.
  minSimpleState(timestamp) as start_time,
  maxSimpleState(timestamp) as end_time,
  anyLast((toString(attribute.app_version), toString(attribute.app_build))) AS app_version,
  anyLast((toString(attribute.os_name), toString(attribute.os_version))) AS os_version,
  anyLast(toString(inet.country_code)) AS country_code,
  anyLast(toString(attribute.network_provider)) AS network_provider,
  anyLast(toString(attribute.network_type)) AS network_type,
  anyLast(toString(attribute.network_generation)) AS network_generation,
  anyLast(toString(attribute.device_locale)) AS device_locale,
  anyLast(toString(attribute.device_manufacturer)) AS device_manufacturer,
  anyLast(toString(attribute.device_name)) AS device_name,
  anyLast(toString(attribute.device_model)) AS device_model,
  anyLast(toString(attribute.user_id)) AS user_id,
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
FROM events
GROUP BY
  team_id,
  app_id,
  session_id;

-- migrate:down
alter table sessions_mv modify query
 SELECT
  team_id,
  app_id,
  session_id,
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
FROM events
GROUP BY
  team_id,
  app_id,
  session_id;
