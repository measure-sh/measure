-- migrate:up
alter table events
  add column if not exists `memory_usage.anon_rss` Int64 comment 'anonymous resident set size, in KiB; -1 when unknown' CODEC(T64, ZSTD(3)) after `memory_usage.rss`,
  add column if not exists `memory_usage.swap` Int64 comment 'private anonymous memory swapped out before compression, in KiB; -1 when unknown' CODEC(T64, ZSTD(3)) after `memory_usage.anon_rss`,
  add column if not exists `memory_usage_absolute.available_memory` Int64 comment 'remaining memory available to the application, in KiB; -1 when unknown' CODEC(T64, ZSTD(3)) after `memory_usage_absolute.used_memory`
settings mutations_sync = 2;

-- migrate:down
alter table events
  drop column if exists `memory_usage.anon_rss`,
  drop column if exists `memory_usage.swap`,
  drop column if exists `memory_usage_absolute.available_memory`
settings mutations_sync = 2;
