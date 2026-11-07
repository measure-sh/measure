-- migrate:up
alter table span_metrics
  add column if not exists `device_model` LowCardinality(String) comment 'device model' CODEC(ZSTD(3)) after `device_name`;

-- migrate:down
alter table span_metrics
  drop column if exists `device_model`;
