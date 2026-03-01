-- migrate:up
alter table events
  add column if not exists `attribute.session_start_time` Nullable(DateTime64(3, 'UTC')) comment 'time when session this event belongs to started' CODEC(DoubleDelta, ZSTD(3)) after `attribute.network_provider`;

-- migrate:down
alter table events
drop column if exists `attribute.session_start_time`;
