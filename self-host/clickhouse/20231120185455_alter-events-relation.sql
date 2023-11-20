-- migrate:up
ALTER TABLE default.events
ADD COLUMN anr.device_locale FixedString(64),
ADD COLUMN exception.device_locale FixedString(64);

-- migrate:down
ALTER TABLE default.events
DROP COLUMN anr.device_locale,
DROP COLUMN exception.device_locale;
