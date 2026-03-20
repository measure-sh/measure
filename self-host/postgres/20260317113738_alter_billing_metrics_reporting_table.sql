-- migrate:up
ALTER TABLE measure.billing_metrics_reporting ADD COLUMN bytes_in BIGINT NOT NULL DEFAULT 0;
COMMENT ON COLUMN measure.billing_metrics_reporting.bytes_in IS 'total bytes ingested on this date';

-- migrate:down
ALTER TABLE measure.billing_metrics_reporting DROP COLUMN bytes_in;