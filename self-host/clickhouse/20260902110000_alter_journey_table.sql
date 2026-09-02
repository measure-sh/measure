-- migrate:up
alter table journey
  add column if not exists `patch_version` LowCardinality(String) comment 'OTA patch version' CODEC(ZSTD(3)) after `app_version`,
  add column if not exists `patch_id` UUID comment 'OTA patch id' CODEC(ZSTD(3)) after `patch_version`
settings mutations_sync = 2;

-- migrate:down
alter table journey
  drop column if exists `patch_id`,
  drop column if exists `patch_version`
settings mutations_sync = 2;
