-- migrate:up
CREATE TABLE IF NOT EXISTS measure.data_exports (
    team_id UUID PRIMARY KEY REFERENCES measure.teams(id) ON DELETE CASCADE,
    last_exported_date DATE NOT NULL,
    bytes_exported BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT data_exports_bytes_exported_non_negative
        CHECK (bytes_exported >= 0)
);

COMMENT ON TABLE measure.data_exports IS 'Per-team shared export resume state across all datasets (events, spans, ...)';
COMMENT ON COLUMN measure.data_exports.team_id IS 'References the team whose export state this row tracks';
COMMENT ON COLUMN measure.data_exports.last_exported_date IS 'Most recent complete UTC day (YYYY-MM-DD) fully exported across all datasets; the next run resumes from the following day';
COMMENT ON COLUMN measure.data_exports.bytes_exported IS 'Cumulative number of bytes exported for this team across all datasets and runs';
COMMENT ON COLUMN measure.data_exports.created_at IS 'Timestamp when this export state row was first created';
COMMENT ON COLUMN measure.data_exports.updated_at IS 'Timestamp when this export state row was last updated';

-- migrate:down
DROP TABLE IF EXISTS measure.data_exports;
