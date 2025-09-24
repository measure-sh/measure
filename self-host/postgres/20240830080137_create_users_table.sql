-- migrate:up
create table if not exists measure.users (
    id uuid primary key not null,
    name varchar(256),
    email varchar(256) not null,
    invited_by_user_id uuid,
    invited_to_team_id uuid,
    invited_as_role varchar(256),
    confirmed_at timestamptz,
    last_sign_in_at timestamptz not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

comment on column measure.users.id is 'unique id for each user';
comment on column measure.users.name is 'name of the user';
comment on column measure.users.invited_by_user_id is 'id of user who invited this user';
comment on column measure.users.invited_to_team_id is 'id of team to which this user was invited';
comment on column measure.users.invited_as_role is 'role as which this user was invited';
comment on column measure.users.confirmed_at is 'utc timestamp at which user was confirmed';
comment on column measure.users.last_sign_in_at is 'utc timestamp at the time of last user sign in';
comment on column measure.users.created_at is 'utc timestamp at the time of user creation';
comment on column measure.users.updated_at is 'utc timestmap at the time of user update';

-- migrate:down
drop table if exists measure.users;
