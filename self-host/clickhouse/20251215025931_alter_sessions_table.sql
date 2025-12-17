-- migrate:up
alter table sessions
  add column if not exists start_time SimpleAggregateFunction(min, DateTime64(9, 'UTC')) codec(DoubleDelta, ZSTD(3)) after last_event_timestamp,
  add column if not exists end_time SimpleAggregateFunction(max, DateTime64(9, 'UTC')) codec(DoubleDelta, ZSTD(3)) after start_time;

-- migrate:down
alter table sessions
  drop column if exists start_time,
  drop column if exists end_time;
