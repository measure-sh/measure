-- migrate:up
create table if not exists measure.notif_prefs (
    user_id uuid not null references measure.users(id) on delete cascade,
    error_spike boolean not null default true,
    app_hang_spike boolean not null default true,
    bug_report boolean not null default true,
    daily_summary boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id)
);

comment on column measure.notif_prefs.user_id is 'linked user id';
comment on column measure.notif_prefs.error_spike is 'user pref for crash spike email alerts';
comment on column measure.notif_prefs.app_hang_spike is 'user pref for ANR spike email alerts';
comment on column measure.notif_prefs.bug_report is 'user pref for bug report email alerts';
comment on column measure.notif_prefs.daily_summary is 'user pref for daily summary emails';
comment on column measure.notif_prefs.created_at is 'utc timestamp at the time of record creation';
comment on column measure.notif_prefs.updated_at is 'utc timestamp at the time of record update';

-- seed: ensure all existing users have a row
insert into measure.notif_prefs (user_id)
select id from measure.users
on conflict (user_id) do nothing;

-- migrate:down
drop table if exists measure.notif_prefs;