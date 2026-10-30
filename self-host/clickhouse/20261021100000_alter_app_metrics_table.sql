-- migrate:up
alter table app_metrics
  add column if not exists `app_hang_sessions` AggregateFunction(uniq, UUID) comment 'app hang sessions in interval window' CODEC(ZSTD(3)) after `perceived_anr_sessions`
settings mutations_sync = 2;

-- migrate:down
alter table app_metrics
  drop column if exists `app_hang_sessions`
settings mutations_sync = 2;
