-- migrate:up
ALTER TABLE measure.sdk_config
ADD COLUMN min_log_severity_number int not null default 12;

COMMENT ON COLUMN measure.sdk_config.min_log_severity_number IS 'minimum severity number of logs to collect';

-- migrate:down
ALTER TABLE measure.sdk_config
DROP COLUMN min_log_severity_number;
