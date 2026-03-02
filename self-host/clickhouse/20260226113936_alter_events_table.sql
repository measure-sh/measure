-- migrate:up
alter table events
  add column if not exists `attribute.session_start_time` DateTime64(3, 'UTC') comment 'start time of the session containing this event' CODEC(DoubleDelta, ZSTD(3)) after `attribute.network_provider`;

-- migrate:down
alter table events
drop column if exists `attribute.session_start_time`;
