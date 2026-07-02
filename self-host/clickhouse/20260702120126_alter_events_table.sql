-- migrate:up
alter table events drop column if exists `attribute.patch_id`;

-- migrate:down
alter table events drop column if exists `attribute.patch_id`;

-- migrate:up
alter table events add column if not exists `attribute.patch_id` UUID comment 'OTA patch identifier' CODEC(ZSTD(3)) after `attribute.app_build`;

-- migrate:down
alter table events add column if not exists `attribute.patch_id` LowCardinality(String) comment 'OTA patch identifier (CodePush/Shorebird)' CODEC(ZSTD(3)) after `attribute.app_build`;
