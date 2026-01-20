-- migrate:up
INSERT INTO measure.team_billing (
    team_id,
    plan
)
SELECT 
    id,
    'free'
FROM measure.teams
WHERE id NOT IN (SELECT team_id FROM measure.team_billing);

-- migrate:down
DELETE FROM measure.team_billing WHERE plan = 'free';