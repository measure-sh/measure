-- migrate:up
alter table spans
  add column if not exists `attribute.session_start_time` Nullable(DateTime64(3, 'UTC')) comment 'time when session this span belongs to started' CODEC(DoubleDelta, ZSTD(3)) after `attribute.network_provider`;

-- migrate:down
alter table spans
	drop column if exists `attribute.session_start_time`;
