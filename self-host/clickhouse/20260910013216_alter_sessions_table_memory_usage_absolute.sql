-- migrate:up
alter table sessions
  add column if not exists `memory_usage_absolute_percentiles` AggregateFunction(quantiles(0.5, 0.9, 0.95), UInt64) comment 'p50/p90/p95 state of iOS memory footprint (used_memory) for this session' after `memory_usage_percentiles`
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop column if exists `memory_usage_absolute_percentiles`
settings mutations_sync = 2;
