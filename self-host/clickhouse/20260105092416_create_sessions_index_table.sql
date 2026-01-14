-- migrate:up
create table if not exists sessions_index
(
  `team_id` UUID comment 'associated team id' CODEC(LZ4),
  `app_id` UUID comment 'associated app id' CODEC(LZ4),
  `app_version` Tuple(LowCardinality(String), LowCardinality(String)) comment 'associated app version' CODEC(LZ4),
  `session_id` UUID comment 'associated session id' CODEC(LZ4),
  `first_event_timestamp` DateTime64(3) comment 'first event timestamp of the block of events' CODEC(DoubleDelta, ZSTD(3)),
  `last_event_timestamp` DateTime64(3) comment 'last event timestamp of the block of events' CODEC(DoubleDelta, ZSTD(3))
)
engine = MergeTree()
partition by toYYYYMM(first_event_timestamp)
order by (team_id, app_id, session_id)
settings index_granularity = 1024
comment 'index of keys for sessions to make fast session detail queries'

-- migrate:down
drop table if exists sessions_index;
