-- migrate:up
create materialized view span_filters_mv to span_filters as
select distinct app_id,
                toLastDayOfMonth(start_time)            as end_of_month,
                toString(attribute.app_version)         as app_version,
                toString(attribute.os_version)          as os_version,
                toString(attribute.country_code)        as country_code,
                toString(attribute.network_provider)    as network_provider,
                toString(attribute.network_type)        as network_type,
                toString(attribute.network_generation)  as network_generation,
                toString(attribute.device_locale)       as device_locale,
                toString(attribute.device_manufacturer) as device_manufacturer,
                toString(attribute.device_name)         as device_name
from spans
where toString(attribute.os_version) != ''
  and toString(attribute.country_code) != ''
  and toString(attribute.network_provider) != ''
  and toString(attribute.network_type) != ''
  and toString(attribute.network_generation) != ''
  and toString(attribute.device_locale) != ''
  and toString(attribute.device_manufacturer) != ''
  and toString(attribute.device_name) != ''
group by app_id, end_of_month, attribute.app_version,
         attribute.os_version, attribute.country_code,
         attribute.network_provider, attribute.network_type,
         attribute.network_generation, attribute.device_locale,
         attribute.device_manufacturer, attribute.device_name
order by app_id;


-- migrate:down
drop view if exists span_filters_mv;
