/**
 * trigger to call that creates a new
 * team
 */
create or replace trigger create_team_for_user
after insert on auth.users
for each row execute function create_team();