-- migrate:up
ALTER TABLE measure.metrics_reporting
    ADD COLUMN events BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN spans BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN metrics BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN measure.metrics_reporting.events IS 'number of events stored on this date';
COMMENT ON COLUMN measure.metrics_reporting.spans IS 'number of spans stored on this date';
COMMENT ON COLUMN measure.metrics_reporting.metrics IS 'number of metrics stored on this date';

ALTER TABLE measure.metrics_reporting RENAME TO billing_metrics_reporting;

-- migrate:down
ALTER TABLE measure.billing_metrics_reporting RENAME TO metrics_reporting;

ALTER TABLE measure.metrics_reporting
    DROP COLUMN events,
    DROP COLUMN spans,
    DROP COLUMN metrics;
