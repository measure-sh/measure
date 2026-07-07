-- migrate:up
alter table events
  add column if not exists `profile.reason` LowCardinality(String) comment 'occasion the profile was captured, eg. app_fully_drawn, anr' CODEC(ZSTD(3)),
  add column if not exists `profile.format` LowCardinality(String) comment 'profile artifact format, matches attachment type, eg. perfetto_trace or heap_dump' CODEC(ZSTD(3));

-- migrate:down
alter table events
  drop column if exists `profile.reason`,
  drop column if exists `profile.format`;
