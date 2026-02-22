-- migrate:up
create table if not exists measure.network_metrics_reporting (
    team_id uuid not null references measure.teams(id) on delete cascade,
    app_id uuid not null references measure.apps(id) on delete cascade,
    metrics_reported_at timestamptz,
    pattern_generated_at timestamptz,
    primary key (team_id, app_id)
);

comment on table measure.network_metrics_reporting is 'tracks last reported time for network metrics and pattern generation per team and app';
comment on column measure.network_metrics_reporting.team_id is 'the team for which the metrics were reported';
comment on column measure.network_metrics_reporting.app_id is 'the app for which the metrics were reported';
comment on column measure.network_metrics_reporting.metrics_reported_at is 'timestamp when the metrics were last reported';
comment on column measure.network_metrics_reporting.pattern_generated_at is 'timestamp when patterns were last generated';

-- migrate:down
drop table if exists measure.network_metrics_reporting;
