-- migrate:up
create table if not exists measure.mcp_clients (
    id            uuid primary key not null default gen_random_uuid(),
    client_id     text not null unique,
    client_secret text not null,
    client_name   text not null,
    redirect_uris text[] not null default '{}',
    created_at    timestamptz not null default now()
);
comment on table measure.mcp_clients is 'dynamically registered OAuth 2.0 clients for MCP';
comment on column measure.mcp_clients.id is 'unique internal identifier';
comment on column measure.mcp_clients.client_id is 'public client identifier; format: msr_client_<hex(8 random bytes)>';
comment on column measure.mcp_clients.client_secret is 'sha256 hash of raw client secret';
comment on column measure.mcp_clients.client_name is 'human-readable name of the client application';
comment on column measure.mcp_clients.redirect_uris is 'allowed OAuth redirect URIs for this client';
comment on column measure.mcp_clients.created_at is 'timestamp when this client was registered';

-- migrate:down
drop table if exists measure.mcp_clients;