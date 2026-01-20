-- migrate:up
ALTER TABLE measure.teams ADD COLUMN allow_ingest BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE measure.teams ADD COLUMN ingest_blocked_reason TEXT;

COMMENT ON COLUMN measure.teams.allow_ingest IS 'Whether team can ingest events, computed by hourly billing job';
COMMENT ON COLUMN measure.teams.ingest_blocked_reason IS 'Reason for blocking ingestion';

-- migrate:down
ALTER TABLE measure.teams DROP COLUMN allow_ingest;
ALTER TABLE measure.teams DROP COLUMN ingest_blocked_reason;