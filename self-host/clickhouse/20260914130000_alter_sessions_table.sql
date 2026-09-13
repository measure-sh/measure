-- migrate:up
alter table sessions
  add column if not exists `device_total_memory` SimpleAggregateFunction(max, UInt64)
    comment 'total device memory in KiB' CODEC(T64, ZSTD(3)) after `device_model`
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop column if exists `device_total_memory`
settings mutations_sync = 2;
