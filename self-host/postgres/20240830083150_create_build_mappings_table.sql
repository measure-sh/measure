-- migrate:up
create table if not exists measure.build_mappings (
    id uuid primary key not null,
    app_id uuid references measure.apps(id) on delete cascade,
    version_name varchar(256) not null,
    version_code varchar(256) not null,
    mapping_type varchar(32) not null,
    key varchar(256) not null,
    location varchar not null,
    fnv1_hash varchar(34) not null,
    file_size int default 0,
    last_updated timestamptz not null
);

comment on column measure.build_mappings.id is 'unique id for each mapping file';
comment on column measure.build_mappings.app_id is 'linked app id';
comment on column measure.build_mappings.version_name is 'user visible version number of the app';
comment on column measure.build_mappings.version_code is 'incremental build number of the app';
comment on column measure.build_mappings.mapping_type is 'type of the mapping file, like proguard etc';
comment on column measure.build_mappings.key is 'key of the mapping file stored in remote object store';
comment on column measure.build_mappings.location is 'url of the mapping file stored in remote object store';
comment on column measure.build_mappings.fnv1_hash is '64 bit fnv1 hash of the mapping file bytes';
comment on column measure.build_mappings.file_size is 'size of mapping file in bytes';
comment on column measure.build_mappings.last_updated is 'utc timestamp at the time of mapping file upload';

-- migrate:down
drop table if exists measure.build_mappings;
