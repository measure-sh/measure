-- migrate:up
-- 1. Update existing records where retention is less than 30
UPDATE measure.app_settings
SET retention_period = 30
WHERE retention_period < 30;

-- 2. Change the default value to 30 for new records
ALTER TABLE measure.app_settings
ALTER COLUMN retention_period SET DEFAULT 30;


-- migrate:down
-- Revert the default value back to 90
ALTER TABLE measure.app_settings
ALTER COLUMN retention_period SET DEFAULT 90;

-- Note: We cannot revert the UPDATE (data change) in the down migration 
-- because the original values (e.g., 7, 15) are lost after the update.