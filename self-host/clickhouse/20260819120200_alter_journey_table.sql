-- migrate:up
alter table journey
  add column if not exists `exception.severity` LowCardinality(String) comment 'exception severity' after `exception.handled`
settings mutations_sync = 2;

-- migrate:down
alter table journey
  drop column if exists `exception.severity`
settings mutations_sync = 2;
