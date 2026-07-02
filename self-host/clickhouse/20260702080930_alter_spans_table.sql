-- migrate:up
alter table spans
  add column if not exists `attribute.patch_version` LowCardinality(String) COMMENT 'OTA patch version (free-form)' CODEC(ZSTD(3)) after `attribute.patch_id`;

-- migrate:down
alter table spans
  drop column if exists `attribute.patch_version`;
