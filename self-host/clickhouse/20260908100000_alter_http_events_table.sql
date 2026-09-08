-- migrate:up
alter table http_events
  add column if not exists `attribute.patch_version` LowCardinality(String) comment 'OTA patch version' CODEC(ZSTD(3)) after `attribute.app_version`,
  add column if not exists `attribute.patch_id` UUID comment 'OTA patch id' CODEC(ZSTD(3)) after `attribute.patch_version`
settings mutations_sync = 2;

-- migrate:down
alter table http_events
  drop column if exists `attribute.patch_id`,
  drop column if exists `attribute.patch_version`
settings mutations_sync = 2;
