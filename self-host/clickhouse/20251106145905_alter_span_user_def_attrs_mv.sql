-- migrate:up
alter table span_user_def_attrs_mv modify query
SELECT DISTINCT
  team_id,
  app_id,
  span_id,
  session_id,
  toLastDayOfMonth(start_time) AS end_of_month,
  attribute.app_version AS app_version,
  attribute.os_version AS os_version,
  arr_key AS key,
  arr_val.1 AS type,
  arr_val.2 AS value,
  start_time AS ver
FROM spans
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
  key,
  type,
  value,
  span_id,
  session_id,
  ver
ORDER BY app_id ASC;

-- migrate:down
alter table span_user_def_attrs_mv modify query
SELECT DISTINCT
  app_id,
  span_id,
  session_id,
  toLastDayOfMonth(start_time) AS end_of_month,
  attribute.app_version AS app_version,
  attribute.os_version AS os_version,
  arr_key AS key,
  arr_val.1 AS type,
  arr_val.2 AS value,
  start_time AS ver
FROM spans
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
  session_id,
  ver
ORDER BY app_id ASC;
