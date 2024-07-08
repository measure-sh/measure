-- migrate:up
create table if not exists public.auth_sessions (
    id uuid primary key not null,
    user_id uuid not null references public.users(id) on delete cascade,
    oauth_provider text,
    user_metadata jsonb,
    at_expiry_at timestamptz not null,
    rt_expiry_at timestamptz not null,
    created_at timestamptz not null default now()
);

comment on column public.auth_sessions.id is 'unique id of auth session';
comment on column public.auth_sessions.user_id is 'user id of the session holder';
comment on column public.auth_sessions.user_metadata is 'arbitrary metadata associated with the user';
comment on column public.auth_sessions.oauth_provider is 'name of the oauth provider';
comment on column public.auth_sessions.at_expiry_at is 'expiry time of access token';
comment on column public.auth_sessions.rt_expiry_at is 'expiry time of refresh token';
comment on column public.auth_sessions.created_at is 'utc timestamp at the time of record creation';

-- migrate:down
drop table if exists public.auth_sessions;