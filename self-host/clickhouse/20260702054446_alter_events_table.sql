-- migrate:up
alter table events
  add column if not exists `profile.reason` LowCardinality(String) comment 'occasion the profile was captured: app_launch, anr, error, manual or interval' CODEC(ZSTD(3)),
  add column if not exists `profile.format` LowCardinality(String) comment 'profile artifact format, matches attachment type: perfetto_trace, heap_dump or heap_profile' CODEC(ZSTD(3));

-- migrate:down
alter table events
  drop column if exists `profile.reason`,
  drop column if exists `profile.format`;
