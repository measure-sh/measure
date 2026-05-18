-- migrate:up
alter table events
  add column if not exists `exception.severity` LowCardinality(String) CODEC(ZSTD(3)) after `exception.binary_images`,
  add column if not exists `exception.is_custom` Boolean CODEC(ZSTD(3)) after `exception.severity`,
  add column if not exists `exception.num_code` Int32 CODEC(ZSTD(3)) after `exception.severity`,
  add column if not exists `exception.code` String CODEC(ZSTD(3)) after `exception.num_code`,
  add column if not exists `exception.meta` String CODEC(ZSTD(3)) after `exception.code`;

-- migrate:down
alter table events
  drop column if exists `exception.severity`,
  drop column if exists `exception.is_custom`
  drop column if exists `exception.num_code`,
  drop column if exists `exception.code`,
  drop column if exists `exception.meta`;

-- migrate:up
alter table events
  comment column if exists `exception.severity` 'Exception severity',
  comment column if exists `exception.is_custom` 'Exception is custom or not',
  comment column if exists `exception.num_code` 'Exception numeric code',
  comment column if exists `exception.code` 'Exception code',
  comment column if exists `exception.meta` 'Exception metadata';

-- migrate:down
alter table events
  modify column if exists `exception.severity` remove comment,
  modify column if exists `exception.is_custom` remove comment,
  modify column if exists `exception.num_code` remove comment,
  modify column if exists `exception.code` remove comment,
  modify column if exists `exception.meta` remove comment;
