-- migrate:up
INSERT INTO measure.app_threshold_prefs (app_id)
SELECT id FROM measure.apps
ON CONFLICT DO NOTHING;

-- migrate:down
DELETE FROM measure.app_threshold_prefs;