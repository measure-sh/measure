-- migrate:up
INSERT INTO measure.team_threshold_prefs (
    team_id,
    error_good_threshold,
    error_caution_threshold
)
SELECT
    t.id,
    95.00,
    85.00
FROM measure.teams t
WHERE NOT EXISTS (
    SELECT 1
    FROM measure.team_threshold_prefs p
    WHERE p.team_id = t.id
);

-- migrate:down
DELETE FROM measure.team_threshold_prefs
WHERE error_good_threshold = 95.00
AND error_caution_threshold = 85.00;