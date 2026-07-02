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
    max(type = 'anr')                                     as anr,
    attribute.patch_version                               as patch_version
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
    device_name,
    patch_version;

-- migrate:down
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
