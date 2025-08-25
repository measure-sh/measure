-- migrate:up
create table if not exists public.metrics_reporting (
    team_id uuid not null,
    report_date date not null,
    reported_at timestamptz,
    primary key (team_id, report_date)
);

comment on table public.metrics_reporting is 'tracks daily metrics reporting status per team to third party providers';
comment on column public.metrics_reporting.report_date is 'date for which the metrics per team are being reported';
comment on column public.metrics_reporting.reported_at is 'timestamp when metrics were reported';

-- migrate:down
drop table if exists public.metrics_reporting;