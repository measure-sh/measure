-- migrate:up
create table if not exists public.alert_prefs (
    app_id uuid not null references public.apps(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    crash_rate_spike_email boolean not null,
    anr_rate_spike_email boolean not null,
    launch_time_spike_email boolean not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (app_id, user_id)
);

comment on column public.alert_prefs.app_id is 'linked app id';
comment on column public.alert_prefs.user_id is 'linked user id';
comment on column public.alert_prefs.crash_rate_spike_email is 'team admin/owner set pref for enabling email on crash rate spike';
comment on column public.alert_prefs.anr_rate_spike_email is 'team admin/owner set pref for enabling email on ANR rate spike';
comment on column public.alert_prefs.launch_time_spike_email is 'team admin/owner set pref for enabling email on launch time spike';
comment on column public.alert_prefs.created_at is 'utc timestamp at the time of record creation';
comment on column public.alert_prefs.updated_at is 'utc timestamp at the time of record update';

-- migrate:down
drop table if exists public.alert_prefs;