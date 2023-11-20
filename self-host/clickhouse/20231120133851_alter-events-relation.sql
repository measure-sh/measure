-- migrate:up
ALTER TABLE default.events
ADD COLUMN resource.device_locale FixedString(64);

-- migrate:down
ALTER TABLE default.events
DROP COLUMN resource.device_locale;
