-- migrate:up
-- Plain (non-aggregate) columns on an AggregatingMergeTree merge to an
-- unspecified value from one of the merged rows — fine for columns that are
-- constant for the life of a session in practice (device_manufacturer etc.
-- already rely on this), but device_total_memory_kb was observed converging
-- to null after a real merge despite every contributing row being non-null.
-- SimpleAggregateFunction(anyLast, ...) makes the merge deterministic, the
-- same way sum/min/max already do for the table's other rollup columns.
-- DROP and ADD of the same column name must be separate ALTER statements:
-- combined into one ALTER (as this migration originally had it), ClickHouse
-- executed the drop mutation but the column never came back — verified live
-- (system.mutations showed the DROP COLUMN mutation done, system.columns had
-- no device_total_memory_kb at all afterward).
alter table sessions
  drop column if exists device_total_memory_kb
settings mutations_sync = 2;

alter table sessions
  add column if not exists device_total_memory_kb SimpleAggregateFunction(anyLast, Nullable(UInt64)) comment 'total memory available on the device, in kb' after device_model
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop column if exists device_total_memory_kb
settings mutations_sync = 2;

alter table sessions
  add column if not exists device_total_memory_kb Nullable(UInt64) comment 'total memory available on the device, in kb' after device_model
settings mutations_sync = 2;
