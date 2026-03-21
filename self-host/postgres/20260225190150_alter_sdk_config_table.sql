-- migrate:up
ALTER TABLE sdk_config
ADD COLUMN http_sampling_rate float8 not null default 0.01;

COMMENT ON COLUMN sdk_config.http_sampling_rate IS 'sampling rate for http events';

-- migrate:down
ALTER TABLE sdk_config
DROP COLUMN http_sampling_rate;
