-- migrate:up

insert into bug_reports_new 
select 
    event_id,
    app_id,
    session_id,
    timestamp,
    timestamp as updated_at,
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
from bug_reports;

-- migrate:down

truncate table bug_reports_new;