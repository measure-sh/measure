-- migrate:up
DROP TABLE measure.billing_metrics_reporting;

-- migrate:down
CREATE TABLE measure.billing_metrics_reporting (
    team_id UUID NOT NULL,
    report_date DATE NOT NULL,
    events BIGINT NOT NULL DEFAULT 0,
    spans BIGINT NOT NULL DEFAULT 0,
    metrics BIGINT NOT NULL DEFAULT 0,
    bytes_in BIGINT NOT NULL DEFAULT 0,
    reported_at TIMESTAMPTZ,
    PRIMARY KEY (team_id, report_date)
);
