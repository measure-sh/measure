-- migrate:up
DO $$
BEGIN
    -- Rename only if the old column is still present
    IF EXISTS (
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = 'measure.sdk_config'::regclass
          AND attname = 'crash_timeline_duration'
          AND NOT attisdropped
    ) THEN
        ALTER TABLE measure.sdk_config
        RENAME COLUMN crash_timeline_duration TO error_replay_duration;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = 'measure.sdk_config'::regclass
          AND attname = 'crash_take_screenshot'
          AND NOT attisdropped
    ) THEN
        ALTER TABLE measure.sdk_config
        RENAME COLUMN crash_take_screenshot TO error_fatal_take_screenshot;
    END IF;
END $$;

COMMENT ON COLUMN measure.sdk_config.error_replay_duration IS 'session replay length for errors, in seconds';

COMMENT ON COLUMN measure.sdk_config.error_fatal_take_screenshot IS 'whether to take screenshot on fatal error';

ALTER TABLE measure.sdk_config
ADD COLUMN IF NOT EXISTS error_fatal_replay_enabled boolean not null default true;

COMMENT ON COLUMN measure.sdk_config.error_fatal_replay_enabled IS 'whether to collect session replay with fatal errors';

ALTER TABLE measure.sdk_config
ADD COLUMN IF NOT EXISTS error_unhandled_replay_enabled boolean not null default false;

COMMENT ON COLUMN measure.sdk_config.error_unhandled_replay_enabled IS 'whether to collect session replay with unhandled errors';

ALTER TABLE measure.sdk_config
ADD COLUMN IF NOT EXISTS error_handled_replay_enabled boolean not null default false;

COMMENT ON COLUMN measure.sdk_config.error_handled_replay_enabled IS 'whether to collect session replay with handled errors';

ALTER TABLE measure.sdk_config
ADD COLUMN IF NOT EXISTS error_fatal_sampling_rate float8 not null default 100;

COMMENT ON COLUMN measure.sdk_config.error_fatal_sampling_rate IS 'sampling rate for fatal errors';

ALTER TABLE measure.sdk_config
ADD COLUMN IF NOT EXISTS error_unhandled_sampling_rate float8 not null default 100;

COMMENT ON COLUMN measure.sdk_config.error_unhandled_sampling_rate IS 'sampling rate for unhandled errors';

ALTER TABLE measure.sdk_config
ADD COLUMN IF NOT EXISTS error_handled_sampling_rate float8 not null default 0;

COMMENT ON COLUMN measure.sdk_config.error_handled_sampling_rate IS 'sampling rate for handled errors';

-- migrate:down
ALTER TABLE measure.sdk_config
DROP COLUMN IF EXISTS error_handled_sampling_rate;

ALTER TABLE measure.sdk_config
DROP COLUMN IF EXISTS error_unhandled_sampling_rate;

ALTER TABLE measure.sdk_config
DROP COLUMN IF EXISTS error_fatal_sampling_rate;

ALTER TABLE measure.sdk_config
DROP COLUMN IF EXISTS error_handled_replay_enabled;

ALTER TABLE measure.sdk_config
DROP COLUMN IF EXISTS error_unhandled_replay_enabled;

ALTER TABLE measure.sdk_config
DROP COLUMN IF EXISTS error_fatal_replay_enabled;

DO $$
BEGIN
    -- Revert the rename only if the new column is present
    IF EXISTS (
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = 'measure.sdk_config'::regclass
          AND attname = 'error_fatal_take_screenshot'
          AND NOT attisdropped
    ) THEN
        ALTER TABLE measure.sdk_config
        RENAME COLUMN error_fatal_take_screenshot TO crash_take_screenshot;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_attribute
        WHERE attrelid = 'measure.sdk_config'::regclass
          AND attname = 'error_replay_duration'
          AND NOT attisdropped
    ) THEN
        ALTER TABLE measure.sdk_config
        RENAME COLUMN error_replay_duration TO crash_timeline_duration;
    END IF;
END $$;

COMMENT ON COLUMN measure.sdk_config.crash_take_screenshot IS 'whether to take screenshot on crash';

COMMENT ON COLUMN measure.sdk_config.crash_timeline_duration IS 'duration for timeline collected with crashes';
