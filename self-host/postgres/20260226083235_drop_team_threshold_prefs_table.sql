-- migrate:up
  DROP TABLE IF EXISTS measure.team_threshold_prefs;

-- migrate:down
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