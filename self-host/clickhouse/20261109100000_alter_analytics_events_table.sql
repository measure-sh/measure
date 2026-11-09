-- migrate:up
alter table analytics_events
  add column if not exists `attribute.device_model` LowCardinality(String) comment 'model of the device' CODEC(ZSTD(3)) after `attribute.device_name`;

-- migrate:down
alter table analytics_events
  drop column if exists `attribute.device_model`;
