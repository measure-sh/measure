-- migrate:up
CREATE TABLE IF NOT EXISTS measure.app_threshold_prefs (
    app_id UUID PRIMARY KEY REFERENCES measure.apps(id) ON DELETE CASCADE,
    error_good_threshold NUMERIC(5,2) NOT NULL DEFAULT 95.00,
    error_caution_threshold NUMERIC(5,2) NOT NULL DEFAULT 85.00,
    error_spike_min_count_threshold INTEGER NOT NULL DEFAULT 100,
    error_spike_min_rate_threshold NUMERIC(5,2) NOT NULL DEFAULT 0.50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT app_threshold_prefs_good_gt_caution
        CHECK (error_good_threshold > error_caution_threshold),
    CONSTRAINT app_threshold_prefs_good_bounds
        CHECK (error_good_threshold > 0 AND error_good_threshold <= 100),
    CONSTRAINT app_threshold_prefs_caution_bounds
        CHECK (error_caution_threshold >= 0 AND error_caution_threshold < 100),
    CONSTRAINT app_threshold_prefs_min_count_positive
        CHECK (error_spike_min_count_threshold >= 1),
    CONSTRAINT app_threshold_prefs_spike_bounds
        CHECK (error_spike_min_rate_threshold > 0 AND error_spike_min_rate_threshold <= 100)
);

COMMENT ON TABLE measure.app_threshold_prefs IS 'Threshold preferences per app (shared across dashboard and summaries)';
COMMENT ON COLUMN measure.app_threshold_prefs.app_id IS 'References the app these threshold preferences belong to';
COMMENT ON COLUMN measure.app_threshold_prefs.error_good_threshold IS 'Threshold above which error-rate metrics are classified as good';
COMMENT ON COLUMN measure.app_threshold_prefs.error_caution_threshold IS 'Threshold above which error-rate metrics are classified as caution; values at or below are poor';
COMMENT ON COLUMN measure.app_threshold_prefs.error_spike_min_count_threshold IS 'Minimum error count before spike alerts are triggered';
COMMENT ON COLUMN measure.app_threshold_prefs.error_spike_min_rate_threshold IS 'Percentage rate at or above which an error spike alert is triggered';
COMMENT ON COLUMN measure.app_threshold_prefs.created_at IS 'Timestamp when threshold preferences were created';
COMMENT ON COLUMN measure.app_threshold_prefs.updated_at IS 'Timestamp when threshold preferences were last updated';

-- migrate:down
DROP TABLE IF EXISTS measure.app_threshold_prefs;