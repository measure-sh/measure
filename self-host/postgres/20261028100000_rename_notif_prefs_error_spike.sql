-- migrate:up
ALTER TABLE measure.notif_prefs
RENAME COLUMN error_spike TO fatal_error_spike;

COMMENT ON COLUMN measure.notif_prefs.fatal_error_spike IS 'user pref for fatal error spike email alerts';

-- migrate:down
ALTER TABLE measure.notif_prefs
RENAME COLUMN fatal_error_spike TO error_spike;

COMMENT ON COLUMN measure.notif_prefs.error_spike IS 'user pref for crash spike email alerts';
