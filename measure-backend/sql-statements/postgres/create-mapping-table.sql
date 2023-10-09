create table if not exists mapping_files (
    id uuid primary key not null,
    app_id varchar(256) not null,
    version_name varchar(256) not null,
    version_code varchar(256) not null,
    type varchar(32) not null,
    key varchar(256) not null,
    location varchar not null,
    fnv1_hash varchar(34) not null,
    file_size int default 0,
    upload_status varchar(16) not null check (upload_status in ('wip', 'done')),
    timestamp timestamptz not null
)

comment on column mapping_files.id is 'unique id for each mapping file';
comment on column mapping_files.app_id is 'unique identifier of the app';
comment on column mapping_files.version_name is 'user visible version number of the app';
comment on column mapping_files.version_code is 'incremental build number of the app';
comment on column mapping_files.type is 'type of the mapping file, like proguard etc';
comment on column mapping_files.key is 'key of the mapping file stored in remote object store';
comment on column mapping_files.location is 'url of the mapping file stored in remote object store';
comment on column mapping_files.fnv1_hash is '64 bit fnv1 hash of the mapping file bytes';
comment on column mapping_files.file_size is 'size of mapping file in bytes';
comment on column mapping_files.upload_status is 'status of mapping file upload task';
comment on column mapping_files.timestamp is 'utc timestamp at the time of mapping file insertion';