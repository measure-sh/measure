-- migrate:up
create materialized view bug_reports_mv to bug_reports
(
    `team_id`                           UUID,
    `event_id`                          UUID,
    `app_id`                            UUID,
    `session_id`                        UUID,
    `timestamp`                         DateTime64(3, 'UTC'),
    `updated_at`                        DateTime64(3, 'UTC'),
    `status`                            UInt8,
    `description`                       String,
    `app_version`                       Tuple(String, String),
    `os_version`                        Tuple(String, String),
    `country_code`                      String,
    `network_provider`                  String,
    `network_type`                      String,
    `network_generation`                String,
    `device_locale`                     String,
    `device_manufacturer`               String,
    `device_name`                       String,
    `device_model`                      String,
    `user_id`                           String,
    `device_low_power_mode`             Bool,
    `device_thermal_throttling_enabled` Bool,
    `user_defined_attribute`            Map(String, Tuple(Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4), String)),
    `attachments`                       String
)
as select
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

-- migrate:down
drop view if exists bug_reports_mv;
