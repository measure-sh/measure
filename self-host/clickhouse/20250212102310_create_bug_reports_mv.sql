-- migrate:up
create materialized view bug_reports_mv to bug_reports as
select distinct id                                                             as event_id,
                app_id,
                session_id,
                any(timestamp)                                                 as timestamp,
                0                                                              as status,
                any(bug_report.description)                                    as description,
                any((toString(attribute.app_version),
                     toString(attribute.app_build)))                           as app_version,
                any((toString(attribute.os_name),
                     toString(attribute.os_version)))                          as os_version,
                any(toString(inet.country_code))                               as country_code,
                any(toString(attribute.network_provider))                      as network_provider,
                any(toString(attribute.network_type))                          as network_type,
                any(toString(attribute.network_generation))                    as network_generation,
                any(toString(attribute.device_locale))                         as device_locale,
                any(toString(attribute.device_manufacturer))                   as device_manufacturer,
                any(toString(attribute.device_name))                           as device_name,
                any(toString(attribute.device_model))                          as device_model,
                any(toString(attribute.user_id))                               as user_id,
                any(attribute.device_low_power_mode)                           as device_low_power_mode,
                any(attribute.device_thermal_throttling_enabled)               as device_thermal_throttling_enabled,
                any(user_defined_attribute)                                    as user_defined_attribute,
                any(attachments)                                               as attachments
from events
where type = 'bug_report'
group by app_id, session_id, event_id
order by app_id, os_version, app_version, session_id, timestamp, event_id;

-- migrate:down
drop view if exists bug_reports_mv;

