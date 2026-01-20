-- migrate:up
ALTER TABLE measure.apps
ADD COLUMN retention integer NOT NULL DEFAULT 30 CHECK (retention <= 365);

COMMENT ON COLUMN measure.apps.retention IS 'retention period for app data in days';

-- migrate:down
ALTER TABLE measure.apps
DROP COLUMN retention;