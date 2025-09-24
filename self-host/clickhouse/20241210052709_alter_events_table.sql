-- migrate:up
alter table events
    add column if not exists `attribute.device_cpu_arch` LowCardinality(FixedString(16)) after `attribute.device_thermal_throttling_enabled`,
    add column if not exists `lifecycle_view_controller.type` LowCardinality(FixedString(32)) after `lifecycle_fragment.tag`,
    add column if not exists `lifecycle_view_controller.class_name` LowCardinality(FixedString(256)) after `lifecycle_view_controller.type`,
    add column if not exists `lifecycle_swift_ui.type` LowCardinality(FixedString(16)) after `lifecycle_view_controller.class_name`,
    add column if not exists `lifecycle_swift_ui.class_name` LowCardinality(FixedString(256)) after `lifecycle_swift_ui.type`,
    add column if not exists `memory_usage_absolute.max_memory` UInt64 after `memory_usage.interval`,
    add column if not exists `memory_usage_absolute.used_memory` UInt64 after `memory_usage_absolute.max_memory`,
    add column if not exists `memory_usage_absolute.interval` UInt64 after `memory_usage_absolute.used_memory`;


-- migrate:down
alter table events
  drop column if exists `attribute.device_cpu_arch`,
  drop column if exists `lifecycle_view_controller.type`,
  drop column if exists `lifecycle_view_controller.class_name`,
  drop column if exists `lifecycle_swift_ui.type`,
  drop column if exists `lifecycle_swift_ui.class_name`,
  drop column if exists `memory_usage_absolute.max_memory`,
  drop column if exists `memory_usage_absolute.used_memory`,
  drop column if exists `memory_usage_absolute.interval`;
