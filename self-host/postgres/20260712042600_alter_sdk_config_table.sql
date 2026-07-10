-- migrate:up
ALTER TABLE measure.sdk_config
ADD COLUMN log_autocollect_enabled boolean not null default false;

COMMENT ON COLUMN measure.sdk_config.log_autocollect_enabled IS 'whether the SDK automatically collects platform logs';

ALTER TABLE measure.sdk_config
ADD COLUMN log_min_severity int not null default 16;

COMMENT ON COLUMN measure.sdk_config.log_min_severity IS 'minimum severity number of logs to collect';

ALTER TABLE measure.sdk_config
ADD COLUMN log_ignore_patterns text [] not null default '{}';

COMMENT ON COLUMN measure.sdk_config.log_ignore_patterns IS 'regex ignore patterns; logs whose body matches any pattern are discarded';

-- migrate:down
ALTER TABLE measure.sdk_config
DROP COLUMN log_ignore_patterns;

ALTER TABLE measure.sdk_config
DROP COLUMN log_min_severity;

ALTER TABLE measure.sdk_config
DROP COLUMN log_autocollect_enabled;
