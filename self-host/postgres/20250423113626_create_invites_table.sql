-- migrate:up
create table if not exists public.invites (
    id uuid primary key not null,
    invited_by_user_id uuid references public.users(id) on delete cascade,
    invited_to_team_id uuid references public.teams(id) on delete cascade,
    invited_as_role varchar(256) references public.roles(name) on delete cascade,
    email varchar(256) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (invited_to_team_id, email)
);

comment on table public.invites is 'table storing user invitations';
comment on column public.invites.id is 'unique id for each invitation';
comment on column public.invites.invited_by_user_id is 'id of user who created this invitation';
comment on column public.invites.invited_to_team_id is 'id of team to which the user is invited';
comment on column public.invites.invited_as_role is 'role assigned to the invited user';
comment on column public.invites.email is 'email address of the invited user';
comment on column public.invites.created_at is 'utc timestamp at the time of invitation creation';
comment on column public.invites.updated_at is 'utc timestamp at the time of invitation update';

-- migrate:down
drop table if exists public.invites;