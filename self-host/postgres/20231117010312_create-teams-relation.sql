-- migrate:up
create table if not exists public.teams (
    id uuid primary key not null default gen_random_uuid(),
    name varchar(256) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null
);

comment on column public.teams.id is 'unique id for each team';
comment on column public.teams.name is 'name of the team';
comment on column public.teams.created_at is 'utc timestamp at the time of team creation';
comment on column public.teams.updated_at is 'utc timestmap at the time of team name update';

-- migrate:down
drop table if exists public.teams;