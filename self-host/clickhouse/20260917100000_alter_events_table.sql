-- migrate:up
alter table events
  add column if not exists `memory_usage_absolute.available_memory` Nullable(UInt64) default NULL comment 'remaining process allocation headroom, in KiB; NULL when unavailable' CODEC(T64, ZSTD(3)) after `memory_usage_absolute.used_memory`
settings mutations_sync = 2;

-- migrate:down
alter table events
  drop column if exists `memory_usage_absolute.available_memory`
settings mutations_sync = 2;
