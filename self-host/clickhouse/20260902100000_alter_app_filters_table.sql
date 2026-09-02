-- migrate:up
alter table app_filters
  add column if not exists `patch_id` UUID comment 'OTA patch id' CODEC(ZSTD(3)),
  modify order by (team_id, app_id, end_of_month, exception, anr, network_type, network_generation, os_version, app_version, country_code, device_manufacturer, device_locale, network_provider, device_name, patch_version, patch_id);

-- migrate:down
alter table app_filters
  modify order by (team_id, app_id, end_of_month, exception, anr, network_type, network_generation, os_version, app_version, country_code, device_manufacturer, device_locale, network_provider, device_name, patch_version);

-- migrate:up
select 1;

-- migrate:down
alter table app_filters
  drop column if exists `patch_id`;
