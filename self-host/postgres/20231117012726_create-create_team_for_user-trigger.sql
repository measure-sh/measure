-- migrate:up
/**
 * trigger to call that creates a new
 * team
 */
create or replace trigger create_team_for_user
after insert on public.users
for each row execute function create_team();

-- migrate:down
drop trigger if exists create_team_for_user on public.users;