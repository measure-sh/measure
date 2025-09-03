-- migrate:up
create table if not exists measure.build_sizes (
    id uuid primary key not null default gen_random_uuid(),
    app_id uuid references measure.apps(id) on delete cascade,
    version_name varchar(256) not null,
    version_code varchar(256) not null,
    build_size int default 0,
    build_type varchar(64) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(app_id, version_name, version_code, build_type)
);

comment on column measure.build_sizes.id is 'unique id for each build size';
comment on column measure.build_sizes.app_id is 'linked app id';
comment on column measure.build_sizes.version_name is 'user visible version number of the app';
comment on column measure.build_sizes.version_code is 'incremental build number of the app';
comment on column measure.build_sizes.build_size is 'build size of the app';
comment on column measure.build_sizes.build_type is 'type of build. can be `aab` or `apk`';
comment on column measure.build_sizes.created_at is 'utc timestamp at the time of record creation';

-- migrate:down
drop table if exists measure.build_sizes;
