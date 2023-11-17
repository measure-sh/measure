-- migrate:up
create table if not exists public.team_invitations (
    id uuid primary key not null default gen_random_uuid(),
    team_id uuid not null,
    user_id uuid references auth.users(id) on delete cascade,
    email varchar(256) not null,
    role varchar(256) references public.roles(name) on delete cascade,
    code varchar(256) not null,
    invite_sent_count int default 0,
    last_invite_sent_at timestamptz not null,
    invite_expires_at timestamptz not null,
    created_at timestamptz not null default current_timestamp
);

comment on column public.team_invitations.id is 'unique id for each team member invite';
comment on column public.team_invitations.team_id is 'team id to which invitee is being invited';
comment on column public.team_invitations.user_id is 'user id of inviter';
comment on column public.team_invitations.email is 'email of invitee';
comment on column public.team_invitations.role is 'role of invitee as decided by inviter at time of invite request';
comment on column public.team_invitations.code is 'cryptographically unique invite code generated per invitee';
comment on column public.team_invitations.invite_sent_count is 'count of email invite (re)tries';
comment on column public.team_invitations.last_invite_sent_at is 'utc timestamp at the time of last email invite sent';
comment on column public.team_invitations.invite_expires_at is 'utc timestamp of invite expiration';
comment on column public.team_invitations.created_at is 'utc timestamp at the time of invite request creation';

-- migrate:down
drop table if exists public.team_invitations;