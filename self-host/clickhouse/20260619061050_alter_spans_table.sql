-- migrate:up
alter table spans
  add column if not exists `attribute.patch_id` LowCardinality(String) COMMENT 'OTA patch identifier (CodePush/Shorebird)' CODEC(ZSTD(3)) after `attribute.app_version`;

-- migrate:down
alter table spans
  drop column if exists `attribute.patch_id`;
