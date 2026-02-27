-- migrate:up
alter table spans
  add column if not exists `attribute.session_start_time` DateTime64(3, 'UTC') comment 'start time of the session containing this span' CODEC(DoubleDelta, ZSTD(3)) after `attribute.network_provider`;

-- migrate:down
alter table spans
	drop column if exists `attribute.session_start_time`;
