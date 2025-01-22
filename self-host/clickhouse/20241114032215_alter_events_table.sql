-- migrate:up
alter table events
    add column if not exists `attribute.device_low_power_mode` Boolean after `attribute.device_locale`, comment column `attribute.device_low_power_mode` 'true if low power mode is enabled',
    add column if not exists `attribute.device_thermal_throttling_enabled` Boolean after `attribute.device_low_power_mode`, comment column `attribute.device_thermal_throttling_enabled` 'true if thermal throttling is enabled';

-- migrate:down
alter table events
drop column if exists `attribute.device_low_power_mode`,
drop column if exists `attribute.device_thermal_throttling_enabled`;

