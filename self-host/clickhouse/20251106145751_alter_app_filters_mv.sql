-- migrate:up
alter table app_filters_mv modify query
SELECT DISTINCT
  team_id,
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
FROM events
WHERE (toString(attribute.os_name) != '') AND (toString(attribute.os_version) != '') AND (toString(inet.country_code) != '') AND (toString(attribute.network_provider) != '') AND (toString(attribute.network_type) != '') AND (toString(attribute.network_generation) != '') AND (toString(attribute.device_locale) != '') AND (toString(attribute.device_manufacturer) != '') AND (toString(attribute.device_name) != '')
GROUP BY
  team_id,
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

-- migrate:down
alter table app_filters_mv modify query
SELECT DISTINCT
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
FROM events
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
