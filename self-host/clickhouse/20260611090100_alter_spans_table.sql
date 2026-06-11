-- migrate:up
alter table spans
  drop column if exists `attribute.platform`;

-- migrate:down
alter table spans
  add column if not exists `attribute.platform` LowCardinality(String) CODEC(ZSTD(3)) after `attribute.os_version`;

alter table spans
  comment column if exists `attribute.platform` 'platform identifier';
