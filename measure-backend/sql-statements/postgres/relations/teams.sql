create table if not exists teams (
    id uuid primary key not null default gen_random_uuid(),
    name varchar(256) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null
);

comment on column teams.id is 'unique id for each team';
comment on column teams.name is 'name of the team';
comment on column teams.created_at is 'utc timestamp at the time of team creation';
comment on column teams.updated_at is 'utc timestmap at the time of team name update';