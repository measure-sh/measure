-- migrate:up
create table if not exists public.team_membership (
    id uuid primary key not null default gen_random_uuid(),
    team_id uuid references public.teams(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    role varchar(256) references public.roles(name) on delete cascade,
    role_updated_at timestamptz not null,
    created_at timestamptz not null default current_timestamp
);

comment on column public.team_membership.id is 'unique id for each team membership';
comment on column public.team_membership.team_id is 'team id to which user is a member of';
comment on column public.team_membership.user_id is 'user id of user having membership of team';
comment on column public.team_membership.role is 'role of the invitee';
comment on column public.team_membership.role_updated_at is 'utc timestamp at the time of role change';
comment on column public.team_membership.created_at is 'utc timestamp at the time of team membership';

-- migrate:down
drop table if exists public.team_membership;