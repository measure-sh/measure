-- migrate:up
ALTER TABLE measure.ingestion_metrics
    RENAME COLUMN session_count TO sessions,
    RENAME COLUMN event_count TO events,
    RENAME COLUMN span_count TO spans,
    RENAME COLUMN attachment_count TO attachments,
    DROP COLUMN trace_count,
    DROP COLUMN session_count_days,
    DROP COLUMN event_count_days,
    DROP COLUMN span_count_days,
    DROP COLUMN trace_count_days,
    DROP COLUMN attachment_count_days,
    ADD COLUMN `metrics` AggregateFunction(sum, UInt32) COMMENT 'aggregated number of metrics ingested' CODEC(ZSTD(3));

-- migrate:down
ALTER TABLE measure.ingestion_metrics
    DROP COLUMN metricsm
    ADD COLUMN `trace_count` AggregateFunction(sum, UInt32) CODEC(ZSTD(3)),
    ADD COLUMN `session_count_days` AggregateFunction(sum, UInt32) CODEC(ZSTD(3)),
    ADD COLUMN `event_count_days` AggregateFunction(sum, UInt32) CODEC(ZSTD(3)),
    ADD COLUMN `span_count_days` AggregateFunction(sum, UInt32) CODEC(ZSTD(3)),
    ADD COLUMN `trace_count_days` AggregateFunction(sum, UInt32) CODEC(ZSTD(3)),
    ADD COLUMN `attachment_count_days` AggregateFunction(sum, UInt32) CODEC(ZSTD(3)),
    RENAME COLUMN sessions TO session_count,
    RENAME COLUMN events TO event_count,
    RENAME COLUMN spans TO span_count,
    RENAME COLUMN attachments TO attachment_count;