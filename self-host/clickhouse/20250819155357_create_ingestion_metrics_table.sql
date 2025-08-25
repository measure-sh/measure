-- migrate:up

CREATE TABLE IF NOT EXISTS ingestion_metrics (
    team_id UUID NOT NULL COMMENT 'linked team id' CODEC(ZSTD(3)),
    app_id UUID NOT NULL COMMENT 'linked app id' CODEC(ZSTD(3)),
    timestamp DateTime64(3, 'UTC') NOT NULL COMMENT 'timestamp of ingestion' CODEC(DoubleDelta, ZSTD(3)),
    session_count AggregateFunction(sum, UInt32) COMMENT 'aggregated number of sessions ingested' CODEC(ZSTD(3)),
    event_count AggregateFunction(sum, UInt32) COMMENT 'aggregated number of events ingested' CODEC(ZSTD(3)),
    span_count AggregateFunction(sum, UInt32) COMMENT 'aggregated number of spans ingested' CODEC(ZSTD(3)),
    trace_count AggregateFunction(sum, UInt32) COMMENT 'aggregated number of traces ingested' CODEC(ZSTD(3)),
    attachment_count AggregateFunction(sum, UInt32) COMMENT 'aggregated number of attachments ingested' CODEC(ZSTD(3)),
    session_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated number of sessions ingested x retention period in days' CODEC(ZSTD(3)),
    event_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated number of events ingested x retention period in days' CODEC(ZSTD(3)),
    span_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated number of spans ingested x retention period in days' CODEC(ZSTD(3)),
    trace_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated number of traces ingested x retention period in days' CODEC(ZSTD(3)),
    attachment_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated number of attachments ingested x retention period in days' CODEC(ZSTD(3))
)
ENGINE = AggregatingMergeTree()
ORDER BY (team_id, app_id, timestamp)
PARTITION BY toYYYYMM(timestamp);

-- migrate:down

DROP TABLE IF EXISTS ingestion_metrics;