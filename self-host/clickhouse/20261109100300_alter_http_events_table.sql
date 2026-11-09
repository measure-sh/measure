-- migrate:up
alter table http_events
  add column if not exists `attribute.device_model` LowCardinality(String) comment 'device model (Pixel 8, SM-S921B, etc.)' CODEC(ZSTD(3)) after `attribute.device_name`,
  add index if not exists idx_device_model `attribute.device_model` type bloom_filter(0.25) granularity 2 after idx_device_name
settings mutations_sync = 2;

-- migrate:down
alter table http_events
  drop index if exists idx_device_model,
  drop column if exists `attribute.device_model`
settings mutations_sync = 2;
