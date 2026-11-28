-- migrate:up
alter table sessions
  drop column if exists `unique_strings`;

-- migrate:down
alter table sessions
  add column if not exists `unique_strings` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique log string values' CODEC(ZSTD(3)) after `unique_custom_type_names`;
