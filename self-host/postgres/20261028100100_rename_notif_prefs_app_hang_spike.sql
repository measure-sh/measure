-- migrate:up
ALTER TABLE measure.notif_prefs
RENAME COLUMN app_hang_spike TO anr_app_hang_spike;

COMMENT ON COLUMN measure.notif_prefs.anr_app_hang_spike IS 'user pref for ANR and app hang spike email alerts';

-- migrate:down
ALTER TABLE measure.notif_prefs
RENAME COLUMN anr_app_hang_spike TO app_hang_spike;

COMMENT ON COLUMN measure.notif_prefs.app_hang_spike IS 'user pref for ANR spike email alerts';
