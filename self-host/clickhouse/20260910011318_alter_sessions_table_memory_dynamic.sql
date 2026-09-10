-- migrate:up
alter table sessions
  add column if not exists `device_total_memory_kb` Nullable(UInt64) comment 'total memory available on the device, in kb' after `device_model`,
  add column if not exists `memory_usage_percentiles` AggregateFunction(quantiles(0.5, 0.9, 0.95), UInt64) comment 'p50/p90/p95 state of dynamic memory usage (anon_rss + swap) for this session' after `event_type_counts`
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop column if exists `memory_usage_percentiles`,
  drop column if exists `device_total_memory_kb`
settings mutations_sync = 2;
