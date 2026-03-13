-- migrate:up
alter table events
    drop index if exists attribute_app_version_idx,
    drop index if exists type_idx,
    drop index if exists attribute_os_name_idx,
    drop index if exists attribute_os_version_idx,
    drop index if exists inet_country_code_idx,
    drop index if exists attribute_device_name_idx,
    drop index if exists attribute_device_manufacturer_idx,
    drop index if exists attribute_device_locale_idx,
    drop index if exists attribute_network_provider_idx,
    drop index if exists attribute_network_type_idx,
    drop index if exists user_defined_attribute_key_minmax_idx
settings mutations_sync = 2;

-- migrate:down
alter table events
    add index if not exists user_defined_attribute_key_minmax_idx mapKeys(user_defined_attribute) type minmax granularity 16
settings mutations_sync = 2;

-- migrate:up
alter table events
    modify column if exists `attribute.thread_name` String,
    modify column if exists `attribute.app_version` LowCardinality(String),
    modify column if exists `inet.country_code` LowCardinality(String),
    modify column if exists `attribute.app_unique_id` LowCardinality(String),
    modify column if exists `attribute.device_locale` LowCardinality(String),
    modify column if exists `attribute.os_name` LowCardinality(String),
    modify column if exists `gesture_scroll.direction` LowCardinality(String),
    modify column if exists `lifecycle_activity.type` LowCardinality(String),
    modify column if exists `lifecycle_fragment.type` LowCardinality(String),
    modify column if exists `lifecycle_app.type` LowCardinality(String),
    modify column if exists `attribute.device_manufacturer` String
settings mutations_sync = 2;

-- migrate:down
alter table events
    modify column if exists `attribute.thread_name` FixedString(128),
    modify column if exists `attribute.app_version` LowCardinality(FixedString(128)),
    modify column if exists `inet.country_code` LowCardinality(FixedString(8)),
    modify column if exists `attribute.app_unique_id` LowCardinality(FixedString(128)),
    modify column if exists `attribute.device_locale` LowCardinality(FixedString(64)),
    modify column if exists `attribute.os_name` LowCardinality(FixedString(32)),
    modify column if exists `gesture_scroll.direction` LowCardinality(FixedString(8)),
    modify column if exists `lifecycle_activity.type` LowCardinality(FixedString(32)),
    modify column if exists `lifecycle_fragment.type` LowCardinality(FixedString(32)),
    modify column if exists `lifecycle_app.type` LowCardinality(FixedString(32)),
    modify column if exists `attribute.device_manufacturer` FixedString(256)
settings mutations_sync = 2;
