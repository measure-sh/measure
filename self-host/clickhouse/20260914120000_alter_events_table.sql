-- migrate:up
alter table events
  add column if not exists `attribute.device_total_memory` UInt64 comment 'total device memory, in KiB' CODEC(T64, ZSTD(3)) after `attribute.device_density`
settings mutations_sync = 2;

-- migrate:down
alter table events
  drop column if exists `attribute.device_total_memory`
settings mutations_sync = 2;
