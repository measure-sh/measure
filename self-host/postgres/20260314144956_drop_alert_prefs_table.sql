-- migrate:up
drop table if exists measure.alert_prefs;

-- migrate:down
create table if not exists measure.alert_prefs (
    app_id uuid not null references measure.apps(id) on delete cascade,
    user_id uuid not null references measure.users(id) on delete cascade,
    crash_rate_spike_email boolean not null,
    anr_rate_spike_email boolean not null,
    launch_time_spike_email boolean not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (app_id, user_id)
);