-- migrate:up
create table if not exists ingested_batches (
`team_id` UUID COMMENT 'associated team id' CODEC(LZ4),
`app_id` UUID COMMENT 'associated app id' CODEC(LZ4),
`batch_id` UUID COMMENT 'associated batch id' CODEC(LZ4),
`timestamp` DateTime COMMENT 'inserted at timestamp' CODEC(Delta, ZSTD(3))
)
engine = ReplacingMergeTree
order by (team_id, app_id, batch_id)
ttl timestamp + interval 12 month delete
partition by toYYYYMM(timestamp)
settings index_granularity = 8192;

-- migrate:down
drop table if exists ingested_batches;
