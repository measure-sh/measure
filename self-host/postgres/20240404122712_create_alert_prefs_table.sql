-- migrate:up
create table if not exists public.alert_prefs (
    app_id uuid primary key not null references public.apps(id) on delete cascade,
    crash_rate_spike_email boolean not null,
    crash_rate_spike_slack boolean not null,
    anr_rate_spike_email boolean not null,
    anr_rate_spike_slack boolean not null,
    launch_time_spike_email boolean not null,
    launch_time_spike_slack boolean not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column public.alert_prefs.app_id is 'linked app id';
comment on column public.alert_prefs.crash_rate_spike_email is 'team admin/owner set pref for enabling email on crash rate spike';
comment on column public.alert_prefs.crash_rate_spike_slack is 'team admin/owner set pref for enabling slack message on crash rate spike';
comment on column public.alert_prefs.anr_rate_spike_email is 'team admin/owner set pref for enabling email on ANR rate spike';
comment on column public.alert_prefs.anr_rate_spike_slack is 'team admin/owner set pref for enabling slack message on ANR rate spike';
comment on column public.alert_prefs.launch_time_spike_email is 'team admin/owner set pref for enabling email on launch time spike';
comment on column public.alert_prefs.launch_time_spike_slack is 'team admin/owner set pref for enabling slack message on launch time spike';
comment on column public.alert_prefs.created_at is 'utc timestamp at the time of record creation';
comment on column public.alert_prefs.updated_at is 'utc timestamp at the time of record update';

-- migrate:down
drop table if exists public.alert_prefs;