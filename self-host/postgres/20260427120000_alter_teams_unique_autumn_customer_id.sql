-- migrate:up
DROP INDEX IF EXISTS measure.idx_teams_autumn_customer;

CREATE UNIQUE INDEX idx_teams_autumn_customer
  ON measure.teams(autumn_customer_id)
  WHERE autumn_customer_id IS NOT NULL;

-- migrate:down
DROP INDEX IF EXISTS measure.idx_teams_autumn_customer;

CREATE INDEX idx_teams_autumn_customer
  ON measure.teams(autumn_customer_id)
  WHERE autumn_customer_id IS NOT NULL;
