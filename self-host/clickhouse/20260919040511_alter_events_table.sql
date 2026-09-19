-- migrate:up
alter table events
  add column if not exists `attribute.device_total_memory` UInt64 comment 'total device memory, in KiB' CODEC(T64, ZSTD(3)) after `attribute.device_density`,
  add column if not exists `memory_usage.anon_rss` Nullable(UInt64) default NULL comment 'anonymous resident set size, in KiB' CODEC(T64, ZSTD(3)) after `memory_usage.rss`,
  add column if not exists `memory_usage.swap` Nullable(UInt64) default NULL comment 'private anonymous memory swapped out before compression, in KiB' CODEC(T64, ZSTD(3)) after `memory_usage.anon_rss`,
  add column if not exists `memory_usage.app_importance` LowCardinality(String) comment 'process importance at the time of memory collection' CODEC(ZSTD(3)) after `memory_usage.swap`,
  add column if not exists `memory_usage_absolute.available_memory` Nullable(UInt64) default NULL comment 'remaining memory available to the application, in KiB' CODEC(T64, ZSTD(3)) after `memory_usage_absolute.used_memory`
settings mutations_sync = 2;

-- migrate:down
alter table events
  drop column if exists `memory_usage_absolute.available_memory`,
  drop column if exists `memory_usage.app_importance`,
  drop column if exists `memory_usage.swap`,
  drop column if exists `memory_usage.anon_rss`,
  drop column if exists `attribute.device_total_memory`
settings mutations_sync = 2;
