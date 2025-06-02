-- migrate:up
alter table default.events
  add index if not exists attribute_app_version_idx `attribute.app_version` type minmax granularity 2,
  add index if not exists type_idx `type` type set(100) granularity 2,
  add index if not exists exception_handled_idx `exception.handled` type minmax granularity 2,
  add index if not exists attribute_os_name_idx `attribute.os_name` type minmax granularity 2,
  add index if not exists attribute_os_version_idx `attribute.os_version` type minmax granularity 2,
  add index if not exists inet_country_code_idx `inet.country_code` type minmax granularity 2,
  add index if not exists attribute_device_name_idx `attribute.device_name` type minmax granularity 2,
  add index if not exists attribute_device_manufacturer_idx `attribute.device_manufacturer` type minmax granularity 2,
  add index if not exists attribute_device_locale_idx `attribute.device_locale` type minmax granularity 2,
  add index if not exists attribute_network_provider_idx `attribute.network_provider` type minmax granularity 2,
  add index if not exists attribute_network_type_idx `attribute.network_type` type minmax granularity 2;


-- migrate:down
alter table default.events
  drop index if exists attribute_app_version_idx,
  drop index if exists type_idx,
  drop index if exists exception_handled_idx,
  drop index if exists attribute_os_name_idx,
  drop index if exists attribute_os_version_idx,
  drop index if exists inet_country_code_idx,
  drop index if exists attribute_device_name_idx,
  drop index if exists attribute_device_manufacturer_idx,
  drop index if exists attribute_device_locale_idx,
  drop index if exists attribute_network_provider_idx,
  drop index if exists attribute_network_type_idx;
