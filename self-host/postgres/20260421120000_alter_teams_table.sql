-- migrate:up
ALTER TABLE measure.teams ADD COLUMN autumn_customer_id TEXT;

CREATE INDEX idx_teams_autumn_customer
  ON measure.teams(autumn_customer_id)
  WHERE autumn_customer_id IS NOT NULL;

COMMENT ON COLUMN measure.teams.autumn_customer_id IS 'Autumn (useautumn.com) customer ID for billing';

-- migrate:down
DROP INDEX IF EXISTS measure.idx_teams_autumn_customer;
ALTER TABLE measure.teams DROP COLUMN autumn_customer_id;
