-- migrate:up
alter table bug_reports_mv modify query
select
    team_id,
    event_id,
    app_id,
    session_id,
    temp_timestamp                                            as timestamp,
    temp_timestamp                                            as updated_at,
    status,
    description,
    app_version,
    os_version,
    country_code,
    network_provider,
    network_type,
    network_generation,
    device_locale,
    device_manufacturer,
    device_name,
    device_model,
    user_id,
    device_low_power_mode,
    device_thermal_throttling_enabled,
    patch_version,
    patch_id,
    user_defined_attribute,
    attachments
from (
    select
        team_id,
        id                                                        as event_id,
        app_id,
        session_id,
        any(timestamp)                                            as temp_timestamp,
        0                                                         as status,
        any(bug_report.description)                               as description,
        any((attribute.app_version, attribute.app_build))         as app_version,
        any((attribute.os_name, attribute.os_version))            as os_version,
        any(inet.country_code)                                    as country_code,
        any(attribute.network_provider)                           as network_provider,
        any(attribute.network_type)                               as network_type,
        any(attribute.network_generation)                         as network_generation,
        any(attribute.device_locale)                              as device_locale,
        any(attribute.device_manufacturer)                        as device_manufacturer,
        any(attribute.device_name)                                as device_name,
        any(attribute.device_model)                               as device_model,
        any(attribute.user_id)                                    as user_id,
        any(attribute.device_low_power_mode)                      as device_low_power_mode,
        any(attribute.device_thermal_throttling_enabled)          as device_thermal_throttling_enabled,
        any(attribute.patch_version)                              as patch_version,
        any(attribute.patch_id)                                   as patch_id,
        any(user_defined_attribute)                               as user_defined_attribute,
        any(attachments)                                          as attachments
    from events
    where type = 'bug_report'
    group by
        team_id,
        app_id,
        session_id,
        event_id
);

-- migrate:down
alter table bug_reports_mv modify query
select
    team_id,
    event_id,
    app_id,
    session_id,
    temp_timestamp                                            as timestamp,
    temp_timestamp                                            as updated_at,
    status,
    description,
    app_version,
    os_version,
    country_code,
    network_provider,
    network_type,
    network_generation,
    device_locale,
    device_manufacturer,
    device_name,
    device_model,
    user_id,
    device_low_power_mode,
    device_thermal_throttling_enabled,
    user_defined_attribute,
    attachments
from (
    select
        team_id,
        id                                                        as event_id,
        app_id,
        session_id,
        any(timestamp)                                            as temp_timestamp,
        0                                                         as status,
        any(bug_report.description)                               as description,
        any((attribute.app_version, attribute.app_build))         as app_version,
        any((attribute.os_name, attribute.os_version))            as os_version,
        any(inet.country_code)                                    as country_code,
        any(attribute.network_provider)                           as network_provider,
        any(attribute.network_type)                               as network_type,
        any(attribute.network_generation)                         as network_generation,
        any(attribute.device_locale)                              as device_locale,
        any(attribute.device_manufacturer)                        as device_manufacturer,
        any(attribute.device_name)                                as device_name,
        any(attribute.device_model)                               as device_model,
        any(attribute.user_id)                                    as user_id,
        any(attribute.device_low_power_mode)                      as device_low_power_mode,
        any(attribute.device_thermal_throttling_enabled)          as device_thermal_throttling_enabled,
        any(user_defined_attribute)                               as user_defined_attribute,
        any(attachments)                                          as attachments
    from events
    where type = 'bug_report'
    group by
        team_id,
        app_id,
        session_id,
        event_id
);
