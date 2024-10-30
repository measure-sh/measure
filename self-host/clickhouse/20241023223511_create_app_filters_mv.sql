-- migrate:up
create materialized view app_filters_mv to app_filters as
select distinct app_id,
                toLastDayOfMonth(timestamp)             as end_of_month,
                (toString(attribute.app_version),
                 toString(attribute.app_build))         as app_version,
                (toString(attribute.os_name),
                 toString(attribute.os_version))        as os_version,
                toString(inet.country_code)             as country_code,
                toString(attribute.network_provider)    as network_provider,
                toString(attribute.network_type)        as network_type,
                toString(attribute.network_generation)  as network_generation,
                toString(attribute.device_locale)       as device_locale,
                toString(attribute.device_manufacturer) as device_manufacturer,
                toString(attribute.device_name)         as device_name,
                if(`type` = 'exception' and `exception.handled` = false, true,
                   false)                               as exception,
                if(type = 'anr', true, false)           as anr
from events
where toString(attribute.os_name) != ''
  and toString(attribute.os_version) != ''
  and toString(inet.country_code) != ''
  and toString(attribute.network_provider) != ''
  and toString(attribute.network_type) != ''
  and toString(attribute.network_generation) != ''
  and toString(attribute.device_locale) != ''
  and toString(attribute.device_manufacturer) != ''
  and toString(attribute.device_name) != ''
group by app_id, end_of_month, attribute.app_version, attribute.app_build, attribute.os_name,
         attribute.os_version, inet.country_code, attribute.network_provider,
         attribute.network_type,
         attribute.network_generation, attribute.device_locale,
         attribute.device_manufacturer, attribute.device_name,
         type, exception.handled
order by app_id;


-- migrate:down
drop view if exists app_filters_mv;
