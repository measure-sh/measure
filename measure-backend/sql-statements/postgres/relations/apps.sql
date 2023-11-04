create table if not exists apps (
    id uuid primary key not null,
    team_id uuid references teams(id) on delete cascade,
    unique_identifier varchar(512) not null,
    platform varchar(256) not null,
    first_version varchar(128),
    latest_version varchar(128),
    first_seen_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

comment on column apps.id is 'unique id for each app';
comment on column apps.team_id is 'team id that this app belongs to';
comment on column apps.unique_identifier is 'unique id lingua franca to app creator';
comment on column apps.platform is 'platform of the app, like iOS, Android, Flutter';
comment on column apps.first_version is 'first version of the app as per ingested sessions from it';
comment on column apps.latest_version is 'latest version of the app as per ingested sessions from it';
comment on column apps.first_seen_at is 'utc timestamp as per the nascent ingested session';
comment on column apps.created_at is 'utc timestamp at the time of app record creation';
comment on column apps.updated_at is 'utc timestamp at the time of app record updation';