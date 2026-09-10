-- migrate:up
-- Plain (non-aggregate) columns on an AggregatingMergeTree merge to an
-- unspecified value from one of the merged rows — fine for columns that are
-- constant for the life of a session in practice (device_manufacturer etc.
-- already rely on this), but device_total_memory_kb was observed converging
-- to null after a real merge despite every contributing row being non-null.
-- SimpleAggregateFunction(anyLast, ...) makes the merge deterministic, the
-- same way sum/min/max already do for the table's other rollup columns.
--
-- A single MODIFY COLUMN, not drop+add: SimpleAggregateFunction shares its
-- on-disk representation with the plain type it wraps, so this is a metadata
-- change only, not a mutation. A same-name drop+add was tried first and
-- found unsafe two different ways — combined into one ALTER, ClickHouse
-- executed the drop but the add never took effect (verified live:
-- system.mutations showed the DROP COLUMN mutation done, system.columns had
-- no device_total_memory_kb at all afterward); split into two ALTER
-- statements, dbmate-clickhouse rejects the block outright ("Multi-statements
-- are not allowed" — each migrate block must be exactly one statement).
alter table sessions
  modify column device_total_memory_kb SimpleAggregateFunction(anyLast, Nullable(UInt64)) comment 'total memory available on the device, in kb'
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  modify column device_total_memory_kb Nullable(UInt64) comment 'total memory available on the device, in kb'
settings mutations_sync = 2;
