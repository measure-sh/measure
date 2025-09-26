-- migrate:up
create table if not exists measure.mcp_keys (
    id uuid primary key not null default gen_random_uuid(),
    user_id uuid not null references measure.users(id) on delete cascade,
    team_id uuid not null references measure.teams(id) on delete cascade,
    name text not null,
    key_prefix varchar(16) not null,
    key_value varchar(256) not null,
    checksum varchar(16) not null,
    revoked boolean default false,
    last_seen timestamptz,
    created_at timestamptz not null default now()
);

comment on table measure.mcp_keys is 'tracks MCP keys per user per team';
comment on column measure.mcp_keys.user_id is 'internal user UUID';
comment on column measure.mcp_keys.team_id is 'internal team UUID';
comment on column measure.mcp_keys.name is 'name of the key';
comment on column measure.mcp_keys.key_prefix is 'constant prefix for the key';
comment on column measure.mcp_keys.key_value is 'key value';
comment on column measure.mcp_keys.checksum is 'checksum of key value';
comment on column measure.mcp_keys.revoked is 'has the key been revoked earlier';
comment on column measure.mcp_keys.last_seen is 'utc timestamp at the time of last key usage seen';
comment on column measure.mcp_keys.created_at is 'utc timestamp at the time of key creation';

-- migrate:down
drop table if exists measure.mcp_keys;
