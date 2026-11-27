-- migrate:up
alter table events
  drop column if exists `navigation.to`,
  drop column if exists `navigation.from`,
  drop column if exists `navigation.source`
settings mutations_sync = 2;

-- migrate:down
alter table events
  add column if not exists `navigation.to` String comment 'destination page or screen where the navigation led to' CODEC(ZSTD(3)) after `cpu_usage.percentage_usage`,
  add column if not exists `navigation.from` String comment 'source page or screen from where the navigation was triggered' CODEC(ZSTD(3)) after `navigation.to`,
  add column if not exists `navigation.source` String comment 'how the event was collected example a library or framework name' CODEC(ZSTD(3)) after `navigation.from`
settings mutations_sync = 2;
