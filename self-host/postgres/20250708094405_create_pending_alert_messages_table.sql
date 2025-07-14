-- migrate:up
create table if not exists public.pending_alert_messages(
    id uuid primary key not null,
    team_id uuid references public.teams(id) on delete cascade,
    app_id uuid references public.apps(id) on delete cascade,
    channel varchar(256) not null,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.pending_alert_messages is 'table storing pending alert messages';
comment on column public.pending_alert_messages.id is 'unique id for each pending alert message';
comment on column public.pending_alert_messages.team_id is 'id of team to which the pending alert message belongs';
comment on column public.pending_alert_messages.app_id is 'id of app to which the pending alert message belongs';
comment on column public.pending_alert_messages.channel is 'channel used for sending the alert message, ex: "email", "slack", etc.';
comment on column public.pending_alert_messages.data is 'data needed to send the alert message along with message content, ex: email address for email channel, slack channel id for slack channel etc.';
comment on column public.pending_alert_messages.created_at is 'utc timestamp at the time of record creation';
comment on column public.pending_alert_messages.updated_at is 'utc timestamp at the time of record update';

-- migrate:down
drop table if exists public.pending_alert_messages;