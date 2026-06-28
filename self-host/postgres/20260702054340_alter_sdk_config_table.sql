-- migrate:up
ALTER TABLE sdk_config
ADD COLUMN profile_sampling_rate float8 not null default 100;

COMMENT ON COLUMN sdk_config.profile_sampling_rate IS 'sampling rate for profile events';

-- migrate:down
ALTER TABLE sdk_config
DROP COLUMN profile_sampling_rate;
