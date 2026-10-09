-- migrate:up
alter table sessions
  add column if not exists `app_hang_recovered_count` SimpleAggregateFunction(sum, UInt64) CODEC(ZSTD(3)) after `anr_count`,
  add column if not exists `app_hang_killed_count` SimpleAggregateFunction(sum, UInt64) CODEC(ZSTD(3)) after `app_hang_recovered_count`
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop column if exists `app_hang_killed_count`,
  drop column if exists `app_hang_recovered_count`
settings mutations_sync = 2;

-- migrate:up
alter table sessions
  comment column if exists app_hang_recovered_count 'count of app hangs the main thread recovered from in this session',
  comment column if exists app_hang_killed_count 'count of app hangs the process died during in this session';

-- migrate:down
alter table sessions
  modify column if exists app_hang_recovered_count remove comment,
  modify column if exists app_hang_killed_count remove comment;

-- migrate:up
alter table sessions
  add index if not exists app_hang_recovered_count_minmax_idx app_hang_recovered_count type minmax granularity 1 after anr_count_minmax_idx,
  add index if not exists app_hang_killed_count_minmax_idx app_hang_killed_count type minmax granularity 1 after app_hang_recovered_count_minmax_idx
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop index if exists app_hang_killed_count_minmax_idx,
  drop index if exists app_hang_recovered_count_minmax_idx
settings mutations_sync = 2;
