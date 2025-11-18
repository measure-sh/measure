-- migrate:up
alter table user_def_attrs_mv modify query
SELECT DISTINCT
  team_id,
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
  arr_val.2 AS value,
  timestamp AS ver
FROM events
ARRAY JOIN
  mapKeys(user_defined_attribute) AS arr_key,
  mapValues(user_defined_attribute) AS arr_val
WHERE length(user_defined_attribute) > 0
GROUP BY
  team_id,
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
  session_id,
  ver
ORDER BY app_id ASC;

-- migrate:down
alter table user_def_attrs_mv modify query
SELECT DISTINCT
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
  arr_val.2 AS value,
  timestamp AS ver
FROM events
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
  session_id,
  ver
ORDER BY app_id ASC;
