-- migrate:up
create table if not exists measure.alerts(
    id uuid primary key not null,
    team_id uuid references measure.teams(id) on delete cascade,
    app_id uuid references measure.apps(id) on delete cascade,
    entity_id varchar(256) not null,
    type varchar(256) not null,
    message varchar not null,
    url varchar not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table measure.alerts is 'table storing alerts';
comment on column measure.alerts.id is 'unique id for each alert';
comment on column measure.alerts.team_id is 'id of team to which the alert belongs';
comment on column measure.alerts.app_id is 'id of app to which the alert belongs';
comment on column measure.alerts.entity_id is 'id of entity which is being alerted on. ex: crash id, anr id, trace id etc.';
comment on column measure.alerts.type is 'alert type, ex: "new_crash", "crash_spike", "new_anr", "anr_spike", "trace_slowdown" etc.';
comment on column measure.alerts.message is 'alert message, ex: "New crash detected"';
comment on column measure.alerts.url is 'url to the details page of whatever the alert is for';
comment on column measure.alerts.created_at is 'utc timestamp at the time of alert record creation';
comment on column measure.alerts.updated_at is 'utc timestamp at the time of alert record update';

-- migrate:down
drop table if exists measure.alerts;
