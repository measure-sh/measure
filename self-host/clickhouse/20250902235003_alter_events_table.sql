-- migrate:up
alter table events
comment column if exists `attribute.device_low_power_mode` 'true if low power mode is enabled',
comment column if exists `attribute.device_thermal_throttling_enabled` 'true if thermal throttling is enabled';

-- migrate:down
alter table events
modify column if exists `attribute.device_low_power_mode` remove comment,
modify column if exists `attribute.device_thermal_throttling_enabled` remove comment;
