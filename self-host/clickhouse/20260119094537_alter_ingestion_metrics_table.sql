-- migrate:up

ALTER TABLE ingestion_metrics
    ADD COLUMN IF NOT EXISTS launch_time_count AggregateFunction(sum, UInt32) COMMENT 'aggregated number of launch time events' CODEC(ZSTD(3)),
    ADD COLUMN IF NOT EXISTS total_billable_count AggregateFunction(sum, UInt32) COMMENT 'aggregated total billable units' CODEC(ZSTD(3)),
    ADD COLUMN IF NOT EXISTS total_billable_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated total billable units x retention period in days' CODEC(ZSTD(3)),
    COMMENT COLUMN session_count 'aggregated number of sessions ingested based on session_start events',
    COMMENT COLUMN event_count 'aggregated number of events ingested except for session_start and launch time events',
    DROP COLUMN IF EXISTS session_count_days,
    DROP COLUMN IF EXISTS event_count_days,
    DROP COLUMN IF EXISTS span_count_days,
    DROP COLUMN IF EXISTS trace_count_days,
    DROP COLUMN IF EXISTS attachment_count_days;

-- migrate:down

ALTER TABLE ingestion_metrics
    ADD COLUMN IF NOT EXISTS session_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated number of sessions ingested x retention period in days' CODEC(ZSTD(3)),
    ADD COLUMN IF NOT EXISTS event_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated number of events ingested x retention period in days' CODEC(ZSTD(3)),
    ADD COLUMN IF NOT EXISTS span_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated number of spans ingested x retention period in days' CODEC(ZSTD(3)),
    ADD COLUMN IF NOT EXISTS trace_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated number of traces ingested x retention period in days' CODEC(ZSTD(3)),
    ADD COLUMN IF NOT EXISTS attachment_count_days AggregateFunction(sum, UInt32) COMMENT 'aggregated number of attachments ingested x retention period in days' CODEC(ZSTD(3)),
    COMMENT COLUMN session_count 'aggregated number of sessions ingested',
    COMMENT COLUMN event_count 'aggregated number of events ingested',
    DROP COLUMN IF EXISTS launch_time_count,
    DROP COLUMN IF EXISTS total_billable_count,
    DROP COLUMN IF EXISTS total_billable_count_days;