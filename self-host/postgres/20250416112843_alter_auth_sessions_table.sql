-- migrate:up
alter table public.auth_sessions
add column own_team_id uuid;

comment on column public.auth_sessions.own_team_id is 'team id of default team of the user';

-- migrate:down
alter table public.auth_sessions
drop column if exists own_team_id;
