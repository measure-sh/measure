-- migrate:up
alter table sessions
  drop index if exists crash_count_minmax_idx,
  rename column if exists crash_count to fatal_exception_count,
  rename column if exists unique_unhandled_exceptions to unique_fatal_exceptions,
  add column if not exists `unhandled_exception_count` SimpleAggregateFunction(sum, UInt64) CODEC(ZSTD(3)) after fatal_exception_count,
  add column if not exists `handled_exception_count` SimpleAggregateFunction(sum, UInt64) CODEC(ZSTD(3)) after unhandled_exception_count
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop column if exists handled_exception_count,
  drop column if exists unhandled_exception_count,
  rename column if exists unique_fatal_exceptions to unique_unhandled_exceptions,
  rename column if exists fatal_exception_count to crash_count,
  add index if not exists crash_count_minmax_idx crash_count type minmax granularity 1 after last_event_timestamp_minmax_idx
settings mutations_sync = 2;

-- migrate:up
-- separate statement so the rename above commits before the IF NOT EXISTS check
alter table sessions
  add column if not exists `unique_unhandled_exceptions` SimpleAggregateFunction(groupUniqArrayArray, Array(Tuple(
    type String,
    message String,
    file_name String,
    class_name String,
    method_name String))) CODEC(ZSTD(3)) after unique_fatal_exceptions
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop column if exists unique_unhandled_exceptions
settings mutations_sync = 2;

-- migrate:up
alter table sessions
  comment column if exists fatal_exception_count 'count of fatal exception events in this session',
  comment column if exists unhandled_exception_count 'count of nonfatal unhandled exception events in this session',
  comment column if exists handled_exception_count 'count of nonfatal handled exception events in this session',
  comment column if exists unique_fatal_exceptions 'list of unique tuples of fatal exception details',
  comment column if exists unique_unhandled_exceptions 'list of unique tuples of nonfatal unhandled exception details',
  comment column if exists unique_handled_exceptions 'list of unique tuples of nonfatal handled exception details';

-- migrate:down
alter table sessions
  comment column if exists fatal_exception_count 'count of crash events in this session',
  comment column if exists unique_fatal_exceptions 'list of unique tuples of unhandled exception details',
  comment column if exists unique_handled_exceptions 'list of unique tuples of handled exception details',
  modify column if exists unhandled_exception_count remove comment,
  modify column if exists handled_exception_count remove comment,
  modify column if exists unique_unhandled_exceptions remove comment;

-- migrate:up
alter table sessions
  add index if not exists fatal_exception_count_minmax_idx fatal_exception_count type minmax granularity 1 after last_event_timestamp_minmax_idx,
  add index if not exists unhandled_exception_count_minmax_idx unhandled_exception_count type minmax granularity 1 after fatal_exception_count_minmax_idx,
  add index if not exists handled_exception_count_minmax_idx handled_exception_count type minmax granularity 1 after unhandled_exception_count_minmax_idx
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop index if exists handled_exception_count_minmax_idx,
  drop index if exists unhandled_exception_count_minmax_idx,
  drop index if exists fatal_exception_count_minmax_idx
settings mutations_sync = 2;
