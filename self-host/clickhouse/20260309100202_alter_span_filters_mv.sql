-- migrate:up
alter table span_filters_mv modify query
select distinct
    team_id,
    app_id,
    toLastDayOfMonth(start_time)   as end_of_month,
    attribute.app_version          as app_version,
    attribute.os_version           as os_version,
    attribute.country_code         as country_code,
    attribute.network_provider     as network_provider,
    attribute.network_type         as network_type,
    attribute.network_generation   as network_generation,
    attribute.device_locale        as device_locale,
    attribute.device_manufacturer  as device_manufacturer,
    attribute.device_name          as device_name
from spans
where toString(attribute.os_version) != ''
  and toString(attribute.country_code) != ''
  and toString(attribute.network_provider) != ''
  and toString(attribute.network_type) != ''
  and toString(attribute.network_generation) != ''
  and toString(attribute.device_locale) != ''
  and toString(attribute.device_manufacturer) != ''
  and toString(attribute.device_name) != ''
group by
    team_id,
    app_id,
    end_of_month,
    attribute.app_version,
    attribute.os_version,
    attribute.country_code,
    attribute.network_provider,
    attribute.network_type,
    attribute.network_generation,
    attribute.device_locale,
    attribute.device_manufacturer,
    attribute.device_name;

-- migrate:down
alter table span_filters_mv modify query
SELECT DISTINCT
    team_id,
    app_id,
    toLastDayOfMonth(start_time) AS end_of_month,
    toString(attribute.app_version) AS app_version,
    toString(attribute.os_version) AS os_version,
    toString(attribute.country_code) AS country_code,
    toString(attribute.network_provider) AS network_provider,
    toString(attribute.network_type) AS network_type,
    toString(attribute.network_generation) AS network_generation,
    toString(attribute.device_locale) AS device_locale,
    toString(attribute.device_manufacturer) AS device_manufacturer,
    toString(attribute.device_name) AS device_name
FROM spans
WHERE (toString(attribute.os_version) != '') AND (toString(attribute.country_code) != '') AND (toString(attribute.network_provider) != '') AND (toString(attribute.network_type) != '') AND (toString(attribute.network_generation) != '') AND (toString(attribute.device_locale) != '') AND (toString(attribute.device_manufacturer) != '') AND (toString(attribute.device_name) != '')
GROUP BY
    team_id,
    app_id,
    end_of_month,
    attribute.app_version,
    attribute.os_version,
    attribute.country_code,
    attribute.network_provider,
    attribute.network_type,
    attribute.network_generation,
    attribute.device_locale,
    attribute.device_manufacturer,
    attribute.device_name
ORDER BY app_id ASC;
