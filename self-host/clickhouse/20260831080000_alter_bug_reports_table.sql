-- migrate:up
alter table bug_reports
  add column if not exists `patch_version` LowCardinality(String) comment 'OTA patch version' CODEC(ZSTD(3)) after `device_thermal_throttling_enabled`,
  add column if not exists `patch_id` UUID comment 'OTA patch id' CODEC(ZSTD(3)) after `patch_version`;

-- migrate:down
alter table bug_reports
  drop column if exists `patch_id`,
  drop column if exists `patch_version`;
