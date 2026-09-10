-- migrate:up
alter table events
    add column if not exists `attribute.device_total_memory_kb` Nullable(UInt64) comment 'total memory available on the device, in kb' after `attribute.device_cpu_arch`,
    add column if not exists `memory_usage_dynamic.anon_rss` Nullable(UInt64) comment 'anonymous resident set size from /proc/self/status, in kb. null when unavailable' CODEC(ZSTD(3)) after `memory_usage_absolute.interval`,
    add column if not exists `memory_usage_dynamic.swap` Nullable(UInt64) comment 'swap usage from /proc/self/status, in kb. null when unavailable' CODEC(ZSTD(3)) after `memory_usage_dynamic.anon_rss`,
    add column if not exists `memory_usage_dynamic.foreground` Bool comment 'whether the app was in the foreground when this reading was taken' after `memory_usage_dynamic.swap`,
    add column if not exists `memory_usage_dynamic.interval` UInt64 comment 'interval between two consecutive readings, in msec' CODEC(T64, ZSTD(3)) after `memory_usage_dynamic.foreground`;

-- migrate:down
alter table events
    drop column if exists `attribute.device_total_memory_kb`,
    drop column if exists `memory_usage_dynamic.anon_rss`,
    drop column if exists `memory_usage_dynamic.swap`,
    drop column if exists `memory_usage_dynamic.foreground`,
    drop column if exists `memory_usage_dynamic.interval`;
