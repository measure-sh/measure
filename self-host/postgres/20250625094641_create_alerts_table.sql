-- migrate:up
create table if not exists public.alerts(
    id uuid primary key not null,
    team_id uuid references public.teams(id) on delete cascade,
    app_id uuid references public.apps(id) on delete cascade,
    entity_id varchar(256) not null,
    type varchar(256) not null,
    message varchar not null,
    url varchar not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.alerts is 'table storing alerts';
comment on column public.alerts.id is 'unique id for each alert';
comment on column public.alerts.team_id is 'id of team to which the alert belongs';
comment on column public.alerts.app_id is 'id of app to which the alert belongs';
comment on column public.alerts.entity_id is 'id of entity which is being alerted on. ex: crash id, anr id, trace id etc.';
comment on column public.alerts.type is 'alert type, ex: "new_crash", "crash_spike", "new_anr", "anr_spike", "trace_slowdown" etc.';
comment on column public.alerts.message is 'alert message, ex: "New crash detected"';
comment on column public.alerts.url is 'url to the details page of whatever the alert is for';
comment on column public.alerts.created_at is 'utc timestamp at the time of alert record creation';
comment on column public.alerts.updated_at is 'utc timestamp at the time of alert record update';

-- migrate:down
drop table if exists public.alerts;