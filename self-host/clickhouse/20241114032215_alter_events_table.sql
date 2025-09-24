-- migrate:up
alter table events
    add column if not exists `attribute.device_low_power_mode` Boolean after `attribute.device_locale`,
    add column if not exists `attribute.device_thermal_throttling_enabled` Boolean after `attribute.device_low_power_mode`;

-- migrate:down
alter table events
drop column if exists `attribute.device_low_power_mode`,
drop column if exists `attribute.device_thermal_throttling_enabled`;
