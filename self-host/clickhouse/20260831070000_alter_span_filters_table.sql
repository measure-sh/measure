-- migrate:up
alter table span_filters
  add column if not exists `patch_id` UUID comment 'OTA patch id' CODEC(ZSTD(3)),
  modify order by (team_id, app_id, end_of_month, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name, patch_version, patch_id);

-- migrate:down
alter table span_filters
  modify order by (team_id, app_id, end_of_month, app_version, os_version, country_code, network_provider, network_type, network_generation, device_locale, device_manufacturer, device_name, patch_version);

-- migrate:up
select 1;

-- migrate:down
alter table span_filters
  drop column if exists `patch_id`;
