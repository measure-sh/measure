-- migrate:up
alter table app_filters_mv modify query
select
    team_id,
    app_id,
    toLastDayOfMonth(timestamp)                           as end_of_month,
    (attribute.app_version, attribute.app_build)          as app_version,
    (attribute.os_name, attribute.os_version)             as os_version,
    inet.country_code                                     as country_code,
    attribute.network_provider                            as network_provider,
    attribute.network_type                                as network_type,
    attribute.network_generation                          as network_generation,
    attribute.device_locale                               as device_locale,
    attribute.device_manufacturer                         as device_manufacturer,
    attribute.device_name                                 as device_name,
    max((type = 'exception') and (exception.handled = 0)) as exception,
    max(type = 'anr')                                     as anr
from events
where attribute.os_name != ''
  and attribute.os_version != ''
  and inet.country_code != ''
  and attribute.network_provider != ''
  and attribute.network_type != ''
  and attribute.network_generation != ''
  and attribute.device_locale != ''
  and attribute.device_manufacturer != ''
  and attribute.device_name != ''
group by
    team_id,
    app_id,
    end_of_month,
    app_version,
    os_version,
    country_code,
    network_provider,
    network_type,
    network_generation,
    device_locale,
    device_manufacturer,
    device_name;

-- migrate:down
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
