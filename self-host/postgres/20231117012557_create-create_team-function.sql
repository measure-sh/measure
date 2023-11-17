-- migrate:up
/**
 * creates a new team based on the
 * newly created user's email username
 * or name, if that's available
 */
create
or replace function public.create_team () returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  team_id uuid;
  team_name text;
  user_name text;
begin
  user_name = new.raw_user_meta_data->>'name';
  if user_name is not null then
    team_name = substring(user_name from 1 for position(' ' in user_name) - 1);
  else
    team_name = substring(new.email from 1 for position('@' in new.email) - 1);
  end if;
  insert into public.teams (name, updated_at) values (team_name || '''s team', now()) returning id into team_id;
  insert into public.team_membership (team_id, user_id, role, role_updated_at) values (team_id, new.id, 'owner', now());
  return new;
end;
$$

-- migrate:down
drop function if exists public.create_team;