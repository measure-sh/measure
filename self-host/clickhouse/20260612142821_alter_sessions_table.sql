-- migrate:up
alter table sessions
  add column if not exists `unique_logs` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique log message values' CODEC(ZSTD(3)) after `unique_strings`
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop column if exists `unique_logs`
settings mutations_sync = 2;
