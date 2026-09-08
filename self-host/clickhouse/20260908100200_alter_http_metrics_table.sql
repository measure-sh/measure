-- migrate:up
alter table http_metrics
  add column if not exists `patch_versions` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of all unique OTA patch versions' after `os_versions`,
  add column if not exists `patch_ids` SimpleAggregateFunction(groupUniqArrayArray, Array(UUID)) comment 'list of all unique OTA patch ids' after `patch_versions`
settings mutations_sync = 2;

-- migrate:down
alter table http_metrics
  drop column if exists `patch_ids`,
  drop column if exists `patch_versions`
settings mutations_sync = 2;
