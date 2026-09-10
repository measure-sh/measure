-- migrate:up
-- Replaces the foreground/background boolean with the four process states
-- Play Console's own Memory usage (Anon RSS + Swap) vital segments by
-- (foreground, user_perceived_service, background, cached).
--
-- One statement, not two: dbmate-clickhouse rejects multiple ";"-separated
-- statements in a single migrate block ("Multi-statements are not allowed").
-- And add/drop use different column names here (process_state vs
-- foreground), not the same name in one ALTER: a same-name drop+add was
-- observed to drop the column without the add taking effect (see
-- 20260910022641_alter_sessions_device_total_memory_kb_type.sql).
alter table events
  add column if not exists `memory_usage_dynamic.process_state` LowCardinality(String) comment 'process state of the app when this reading was taken: foreground, user_perceived_service, background, cached. empty when the event is not memory_usage_dynamic' after `memory_usage_dynamic.swap`,
  drop column if exists `memory_usage_dynamic.foreground`
settings mutations_sync = 2;

-- migrate:down
alter table events
  add column if not exists `memory_usage_dynamic.foreground` Bool comment 'whether the app was in the foreground when this reading was taken' after `memory_usage_dynamic.swap`,
  drop column if exists `memory_usage_dynamic.process_state`
settings mutations_sync = 2;
