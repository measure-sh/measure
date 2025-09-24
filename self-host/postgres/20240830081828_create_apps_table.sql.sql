-- migrate:up
create table if not exists measure.apps (
    id uuid primary key not null default gen_random_uuid(),
    team_id uuid not null references teams(id) on delete cascade,
    unique_identifier varchar(512),
    app_name varchar(512),
    platform varchar(256) check (platform in ('ios', 'android', 'flutter', 'react-native', 'unity')),
    first_version varchar(128),
    onboarded boolean default false,
    onboarded_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null
);

comment on column measure.apps.id is 'unique id for each app';
comment on column measure.apps.team_id is 'team id that this app belongs to';
comment on column measure.apps.unique_identifier is 'unique id lingua franca to app creator';
comment on column measure.apps.app_name is 'name of app lingua franca to app creator';
comment on column measure.apps.platform is 'platform of the app, like iOS, Android, Flutter';
comment on column measure.apps.first_version is 'first version of the app as per ingested sessions from it';
comment on column measure.apps.onboarded is 'app is considered onboarded once it receives the first session';
comment on column measure.apps.onboarded_at is 'utc timestamp at the time of receiving first session';
comment on column measure.apps.created_at is 'utc timestamp at the time of app record creation';
comment on column measure.apps.updated_at is 'utc timestamp at the time of app record updation';

-- migrate:down
drop table if exists measure.apps;
