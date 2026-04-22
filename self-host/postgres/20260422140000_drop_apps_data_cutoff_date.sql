-- migrate:up
ALTER TABLE measure.apps
DROP COLUMN data_cutoff_date;

-- migrate:down
ALTER TABLE measure.apps
ADD COLUMN data_cutoff_date DATE NOT NULL DEFAULT CURRENT_DATE;

COMMENT ON COLUMN measure.apps.data_cutoff_date IS 'high-water mark: oldest date for which data still exists. Only moves forward.';

UPDATE measure.apps
SET data_cutoff_date = GREATEST(created_at::date, CURRENT_DATE - retention);