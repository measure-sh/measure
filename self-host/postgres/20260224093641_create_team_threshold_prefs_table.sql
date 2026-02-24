-- migrate:up
CREATE TABLE IF NOT EXISTS measure.team_threshold_prefs (
    team_id UUID PRIMARY KEY REFERENCES measure.teams(id) ON DELETE CASCADE,
    error_good_threshold NUMERIC(5,2) NOT NULL DEFAULT 95.00,
    error_caution_threshold NUMERIC(5,2) NOT NULL DEFAULT 85.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT team_threshold_prefs_good_gt_caution
      CHECK (error_good_threshold > error_caution_threshold),
    CONSTRAINT team_threshold_prefs_good_bounds
        CHECK (error_good_threshold > 0 AND error_good_threshold <= 100),
    CONSTRAINT team_threshold_prefs_caution_bounds
        CHECK (error_caution_threshold >= 0 AND error_caution_threshold < 100)
  );

COMMENT ON TABLE measure.team_threshold_prefs IS 'Threshold preferences per team (shared across dashboard and summaries)';
COMMENT ON COLUMN measure.team_threshold_prefs.team_id IS 'References the team these threshold preferences belong to';
COMMENT ON COLUMN measure.team_threshold_prefs.error_good_threshold IS 'Threshold above which error-rate metrics are classified as good';
COMMENT ON COLUMN measure.team_threshold_prefs.error_caution_threshold IS 'Threshold above which error-rate metrics are classified as caution; values at or below are poor';
COMMENT ON COLUMN measure.team_threshold_prefs.created_at IS 'Timestamp when threshold preferences were created';
COMMENT ON COLUMN measure.team_threshold_prefs.updated_at IS 'Timestamp when threshold preferences were last updated';

-- migrate:down
DROP TABLE IF EXISTS measure.team_threshold_prefs;