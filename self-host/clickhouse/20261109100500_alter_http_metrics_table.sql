-- migrate:up
alter table http_metrics
  add column if not exists `device_models` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique device models' after `device_names`
settings mutations_sync = 2;

-- migrate:down
alter table http_metrics
  drop column if exists `device_models`
settings mutations_sync = 2;
