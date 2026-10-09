-- migrate:up
alter table events
  add column if not exists `app_hang.fingerprint` String comment 'fingerprint for app hang similarity classification' CODEC(ZSTD(3)) after `anr.foreground`,
  add column if not exists `app_hang.exceptions` String comment 'app hang blocked thread data' CODEC(ZSTD(3)) after `app_hang.fingerprint`,
  add column if not exists `app_hang.binary_images` String comment 'list of apple binary images for the app hang' CODEC(ZSTD(3)) after `app_hang.exceptions`,
  add column if not exists `app_hang.duration` UInt32 comment 'duration the main thread stayed blocked, in milliseconds' CODEC(T64, ZSTD(3)) after `app_hang.binary_images`,
  add column if not exists `app_hang.state` LowCardinality(String) comment 'either - recovered, killed' CODEC(ZSTD(3)) after `app_hang.duration`,
  add column if not exists `app_hang.framework` String comment 'the framework the app hang originated from' CODEC(ZSTD(3)) after `app_hang.state`,
  add column if not exists `app_hang.foreground` Bool comment 'true if the app hang was perceived by end user' CODEC(ZSTD(3)) after `app_hang.framework`,
  add index if not exists app_hang_fingerprint_bloom_idx `app_hang.fingerprint` type bloom_filter(0.025) granularity 4
settings mutations_sync = 2;

-- migrate:down
alter table events
  drop index if exists app_hang_fingerprint_bloom_idx,
  drop column if exists `app_hang.fingerprint`,
  drop column if exists `app_hang.exceptions`,
  drop column if exists `app_hang.binary_images`,
  drop column if exists `app_hang.duration`,
  drop column if exists `app_hang.state`,
  drop column if exists `app_hang.framework`,
  drop column if exists `app_hang.foreground`
settings mutations_sync = 2;
