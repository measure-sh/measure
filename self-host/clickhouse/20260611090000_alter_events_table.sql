-- migrate:up
alter table events
  drop column if exists `attribute.platform`;

-- migrate:down
alter table events
  add column if not exists `attribute.platform` LowCardinality(String) CODEC(ZSTD(3)) after `attribute.app_unique_id`;

alter table events
  comment column if exists `attribute.platform` 'platform identifier';
