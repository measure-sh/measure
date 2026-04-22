-- migrate:up
ALTER TABLE measure.teams
  DROP COLUMN allow_ingest,
  DROP COLUMN ingest_blocked_reason;

-- migrate:down
ALTER TABLE measure.teams
  ADD COLUMN allow_ingest BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN ingest_blocked_reason TEXT;
