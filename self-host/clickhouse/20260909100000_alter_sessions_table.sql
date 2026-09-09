-- migrate:up
alter table sessions
  add column if not exists `patch_version` SimpleAggregateFunction(max, String) comment 'OTA patch version' CODEC(ZSTD(3)) after `app_version`,
  add column if not exists `patch_id` SimpleAggregateFunction(max, UUID) comment 'OTA patch id' CODEC(ZSTD(3)) after `patch_version`,
  add column if not exists `unique_screen_view_names` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique screen view names' CODEC(ZSTD(3)) after `unique_subview_classnames`,
  add column if not exists `unique_view_controller_classnames` SimpleAggregateFunction(groupUniqArrayArray, Array(String)) comment 'list of unique view controller class names' CODEC(ZSTD(3)) after `unique_screen_view_names`
settings mutations_sync = 2;

-- migrate:down
alter table sessions
  drop column if exists `unique_view_controller_classnames`,
  drop column if exists `unique_screen_view_names`,
  drop column if exists `patch_id`,
  drop column if exists `patch_version`
settings mutations_sync = 2;
