-- migrate:up
/**
 * creates a new team based on the
 * newly created user's email username
 * or name, if that's available
 */
create
or replace function public.create_team()
returns trigger
language plpgsql
security definer set search_path = auth,public
as $$
declare
  team_id uuid;
  team_name text;
  user_name text;
  inviter_team_id uuid;
  invitee_role text;
  time_now timestamptz;
begin
  -- noop if account has not been confirmed
  if new.confirmed_at is null and old.confirmed_at is null then
    return new;
  end if;

  -- prepare new user's team name
  user_name = new.raw_user_meta_data->>'name';
  if user_name is not null then
    team_name = substring(user_name from 1 for position(' ' in user_name) - 1);
  else
    team_name = substring(new.email from 1 for position('@' in new.email) - 1);
  end if;

  -- get invite details
  inviter_team_id = new.raw_user_meta_data->'invite'->>'teamId';
  invitee_role = new.raw_user_meta_data->'invite'->>'role';

  -- update tables
  time_now = now();
  if new.confirmed_at is not null and old.confirmed_at is null then
    insert into public.teams (name, updated_at) values (team_name || '''s team', time_now) returning id into team_id;
    insert into public.team_membership (team_id, user_id, role, role_updated_at) values (team_id, new.id, 'owner', time_now);
    if inviter_team_id is not null and invitee_role is not null then
      insert into public.team_membership (team_id, user_id, role, role_updated_at) values (inviter_team_id::uuid, new.id, invitee_role, time_now);
    end if;
  end if;
  return new;
end;
$$

-- migrate:down
drop function if exists public.create_team;