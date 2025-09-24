-- migrate:up
create table if not exists measure.invites (
    id uuid primary key not null,
    invited_by_user_id uuid references measure.users(id) on delete cascade,
    invited_to_team_id uuid references measure.teams(id) on delete cascade,
    invited_as_role varchar(256) references measure.roles(name) on delete cascade,
    email varchar(256) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (invited_to_team_id, email)
);

comment on table measure.invites is 'table storing user invitations';
comment on column measure.invites.id is 'unique id for each invitation';
comment on column measure.invites.invited_by_user_id is 'id of user who created this invitation';
comment on column measure.invites.invited_to_team_id is 'id of team to which the user is invited';
comment on column measure.invites.invited_as_role is 'role assigned to the invited user';
comment on column measure.invites.email is 'email address of the invited user';
comment on column measure.invites.created_at is 'utc timestamp at the time of invitation creation';
comment on column measure.invites.updated_at is 'utc timestamp at the time of invitation update';

-- migrate:down
drop table if exists measure.invites;
