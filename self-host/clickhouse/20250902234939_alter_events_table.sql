-- migrate:up
alter table events
materialize index if exists attribute_app_version_idx,
materialize index if exists type_idx,
materialize index if exists exception_handled_idx,
materialize index if exists attribute_os_name_idx,
materialize index if exists attribute_os_version_idx,
materialize index if exists inet_country_code_idx,
materialize index if exists attribute_device_name_idx,
materialize index if exists attribute_device_manufacturer_idx,
materialize index if exists attribute_device_locale_idx,
materialize index if exists attribute_network_provider_idx,
materialize index if exists attribute_network_type_idx;


-- migrate:down
alter table events
clear index if exists attribute_app_version_idx,
clear index if exists type_idx,
clear index if exists exception_handled_idx,
clear index if exists attribute_os_name_idx,
clear index if exists attribute_os_version_idx,
clear index if exists inet_country_code_idx,
clear index if exists attribute_device_name_idx,
clear index if exists attribute_device_manufacturer_idx,
clear index if exists attribute_device_locale_idx,
clear index if exists attribute_network_provider_idx,
clear index if exists attribute_network_type_idx;
