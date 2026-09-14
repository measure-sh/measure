-- migrate:up
alter table sessions
  add column if not exists `peak_total_memory` SimpleAggregateFunction(max, UInt64)
    comment 'peak total memory in KiB' CODEC(T64, ZSTD(3)) after `device_total_memory`,
  add column if not exists `peak_total_memory_foreground` SimpleAggregateFunction(max, UInt64)
    comment 'peak total memory in KiB while foreground' CODEC(T64, ZSTD(3)) after `peak_total_memory`,
  add column if not exists `peak_total_memory_user_service` SimpleAggregateFunction(max, UInt64)
    comment 'peak total memory in KiB while user service' CODEC(T64, ZSTD(3)) after `peak_total_memory_foreground`,
  add column if not exists `peak_total_memory_background` SimpleAggregateFunction(max, UInt64)
    comment 'peak total memory in KiB while background' CODEC(T64, ZSTD(3)) after `peak_total_memory_user_service`
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop column if exists `peak_total_memory_background`,
  drop column if exists `peak_total_memory_user_service`,
  drop column if exists `peak_total_memory_foreground`,
  drop column if exists `peak_total_memory`
settings mutations_sync = 2;
