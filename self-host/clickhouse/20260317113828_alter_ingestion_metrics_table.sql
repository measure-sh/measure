-- migrate:up
ALTER TABLE measure.ingestion_metrics
    ADD COLUMN `bytes_in` AggregateFunction(sum, UInt64);

-- migrate:down
ALTER TABLE measure.ingestion_metrics
    DROP COLUMN bytes_in SETTINGS mutations_sync = 2;