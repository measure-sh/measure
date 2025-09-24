-- migrate:up
create table if not exists measure.app_settings (
    app_id uuid primary key not null references measure.apps(id) on delete cascade,
    retention_period int not null default 90,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column measure.app_settings.app_id is 'linked app id';
comment on column measure.app_settings.retention_period is 'data retention period in days';
comment on column measure.app_settings.created_at is 'utc timestamp at the time of record creation';
comment on column measure.app_settings.updated_at is 'utc timestamp at the time of record update';

-- migrate:down
drop table if exists measure.app_settings;
