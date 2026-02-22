-- migrate:up
create table if not exists measure.network_metrics_reporting (
    team_id uuid not null references measure.teams(id) on delete cascade,
    app_id uuid not null references measure.apps(id) on delete cascade,
    reported_at timestamptz,
    primary key (team_id, app_id, reported_at)
);

comment on table measure.network_metrics_reporting is 'tracks last reported time for network metrics per team and app';
comment on column measure.network_metrics_reporting.team_id is 'the team for which the metrics were reported';
comment on column measure.network_metrics_reporting.app_id is 'the app for which the metrics were reported';
comment on column measure.network_metrics_reporting.reported_at is 'timestamp when the metrics were reported';

-- migrate:down
drop table if exists measure.network_metrics_reporting;
