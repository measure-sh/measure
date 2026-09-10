-- migrate:up
ALTER TABLE measure.sdk_config
ADD COLUMN memory_usage_session_sampling_rate float8 not null default 0.01;

COMMENT ON COLUMN measure.sdk_config.memory_usage_session_sampling_rate IS 'percentage of sessions selected for dynamic memory usage collection';

-- migrate:down
ALTER TABLE measure.sdk_config
DROP COLUMN memory_usage_session_sampling_rate;
