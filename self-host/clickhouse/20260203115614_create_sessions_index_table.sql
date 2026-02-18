-- migrate:up
create table if not exists sessions_index
(
  `team_id` LowCardinality(UUID) comment 'associated team id' CODEC(LZ4),
  `app_id` LowCardinality(UUID) comment 'associated app id' CODEC(LZ4),
  `app_version` Tuple(LowCardinality(String), LowCardinality(String)) comment 'associated app version' CODEC(ZSTD(3)),
  `session_id` UUID comment 'associated session id' CODEC(LZ4),
  `first_event_timestamp` DateTime64(3, 'UTC') comment 'first event timestamp of the block of inputs' CODEC(DoubleDelta, ZSTD(3)),
  `last_event_timestamp` DateTime64(3, 'UTC') comment 'last event timestamp of the block of inputs' CODEC(DoubleDelta, ZSTD(3)),

  index first_event_timestamp_minmax_idx first_event_timestamp type minmax granularity 1,
  index last_event_timestamp_minmax_idx last_event_timestamp type minmax granularity 1
)
engine = MergeTree()
partition by toYYYYMM(first_event_timestamp)
order by (team_id, app_id, session_id)
settings index_granularity = 1024
comment 'index of keys for sessions to make fast session detail queries'

-- migrate:down
drop table if exists sessions_index;
