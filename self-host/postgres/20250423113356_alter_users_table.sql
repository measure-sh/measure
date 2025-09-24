-- migrate:up
alter table if exists measure.users
  drop if exists invited_by_user_id,
  drop if exists invited_to_team_id,
  drop if exists invited_as_role;

-- migrate:down
alter table if exists measure.users
  add invited_by_user_id uuid,
  add invited_to_team_id uuid,
  add invited_as_role varchar(256);

comment on column measure.users.invited_by_user_id is 'id of user who invited this user';
comment on column measure.users.invited_to_team_id is 'id of team to which this user was invited';
comment on column measure.users.invited_as_role is 'role as which this user was invited';
