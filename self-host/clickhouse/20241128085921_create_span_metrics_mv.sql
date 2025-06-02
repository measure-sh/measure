-- migrate:up
create materialized view span_metrics_mv to span_metrics as
select app_id,
       span_name,
       span_id,
       status,
       toStartOfFifteenMinutes(start_time)                          as timestamp,
       attribute.app_version                                        as app_version,
       attribute.os_version                                         as os_version,
       attribute.country_code                                       as country_code,
       attribute.network_provider                                   as network_provider,
       attribute.network_type                                       as network_type,
       attribute.network_generation                                 as network_generation,
       attribute.device_locale                                      as device_locale,
       attribute.device_manufacturer                                as device_manufacturer,
       attribute.device_name                                        as device_name,
       attribute.device_low_power_mode                              as device_low_power_mode,
       attribute.device_thermal_throttling_enabled                  as device_thermal_throttling_enabled,
       quantileState(0.50)(date_diff('ms', start_time, end_time))   as p50,
       quantileState(0.90)(date_diff('ms', start_time, end_time))   as p90,
       quantileState(0.95)(date_diff('ms', start_time, end_time))   as p95,
       quantileState(0.99)(date_diff('ms', start_time, end_time))   as p99
from spans
group by app_id, span_name, span_id, status, timestamp, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name, device_low_power_mode, device_thermal_throttling_enabled
order by app_id, span_name, span_id, status, timestamp, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name, device_low_power_mode, device_thermal_throttling_enabled;


-- migrate:down
drop view if exists span_metrics_mv;
