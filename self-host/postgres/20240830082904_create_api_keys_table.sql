-- migrate:up
create table if not exists measure.api_keys (
    id uuid primary key not null default gen_random_uuid(),
    app_id uuid references measure.apps(id) on delete cascade,
    key_prefix varchar(16) not null,
    key_value varchar(256) not null,
    checksum varchar(16) not null,
    revoked boolean default false,
    last_seen timestamptz,
    created_at timestamptz not null default now()
);

comment on column measure.api_keys.id is 'unique id for each api key';
comment on column measure.api_keys.app_id is 'linked app id';
comment on column measure.api_keys.key_prefix is 'constant prefix for the key';
comment on column measure.api_keys.key_value is 'key value';
comment on column measure.api_keys.checksum is 'checksum of key value';
comment on column measure.api_keys.revoked is 'has the key been revoked earlier';
comment on column measure.api_keys.last_seen is 'utc timestamp at the time of last key usage seen';
comment on column measure.api_keys.created_at is 'utc timestamp at the time of api key creation';

-- migrate:down
drop table if exists measure.api_keys;
