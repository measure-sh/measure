-- migrate:up

create materialized view bug_reports_mv to bug_reports as
select
    event_id,
    app_id,
    session_id,
    temp_timestamp AS timestamp,
    temp_timestamp AS updated_at,
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
        id AS event_id,
        app_id,
        session_id,
        any(timestamp) AS temp_timestamp,
        0 AS status,
        any(bug_report.description) AS description,
        any((toString(attribute.app_version), toString(attribute.app_build))) AS app_version,
        any((toString(attribute.os_name), toString(attribute.os_version))) AS os_version,
        any(toString(inet.country_code)) AS country_code,
        any(toString(attribute.network_provider)) AS network_provider,
        any(toString(attribute.network_type)) AS network_type,
        any(toString(attribute.network_generation)) AS network_generation,
        any(toString(attribute.device_locale)) AS device_locale,
        any(toString(attribute.device_manufacturer)) AS device_manufacturer,
        any(toString(attribute.device_name)) AS device_name,
        any(toString(attribute.device_model)) AS device_model,
        any(toString(attribute.user_id)) AS user_id,
        any(attribute.device_low_power_mode) AS device_low_power_mode,
        any(attribute.device_thermal_throttling_enabled) AS device_thermal_throttling_enabled,
        any(user_defined_attribute) AS user_defined_attribute,
        any(attachments) AS attachments
    from events
    where type = 'bug_report'
    group by app_id, session_id, event_id
);

-- migrate:down

drop view if exists bug_reports_mv;
