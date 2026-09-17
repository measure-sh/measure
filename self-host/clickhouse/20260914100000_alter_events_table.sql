-- migrate:up
alter table events
  add column if not exists `memory_usage.anon_rss` Nullable(UInt64) default NULL comment 'anonymous resident set size, in KiB; NULL when unavailable' CODEC(T64, ZSTD(3)) after `memory_usage.rss`,
  add column if not exists `memory_usage.swap` Nullable(UInt64) default NULL comment 'private anonymous memory swapped out before compression, in KiB; NULL when unavailable' CODEC(T64, ZSTD(3)) after `memory_usage.anon_rss`,
  add column if not exists `memory_usage.app_importance` LowCardinality(String) comment 'Android process state: foreground, user_service or background; empty when unavailable' CODEC(ZSTD(3)) after `memory_usage.swap`
settings mutations_sync = 2;

-- migrate:down
alter table events
  drop column if exists `memory_usage.swap`,
  drop column if exists `memory_usage.app_importance`,
  drop column if exists `memory_usage.anon_rss`
settings mutations_sync = 2;
