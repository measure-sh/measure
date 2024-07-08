-- migrate:up
create table if not exists public.auth_states (
    id uuid primary key not null,
    state text not null,
    oauth_provider text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column public.auth_states.id is 'unique id of auth state';
comment on column public.auth_states.state is 'oauth state nonce';
comment on column public.auth_states.oauth_provider is 'name of the social oauth provider';
comment on column public.auth_states.created_at is 'utc timestamp at the time of record creation';
comment on column public.auth_states.updated_at is 'utc timestamp at the time of record updation';

-- migrate:down
drop table if exists public.auth_states;