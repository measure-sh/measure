-- migrate:up
create table if not exists measure.mcp_auth_codes (
    id             uuid primary key not null default gen_random_uuid(),
    code           text not null unique,
    user_id        uuid not null references measure.users(id) on delete cascade,
    client_id      text not null,
    redirect_uri   text not null,
    code_challenge text,
    provider       text,
    provider_token text,
    expires_at     timestamptz not null,
    used           boolean not null default false,
    created_at     timestamptz not null default now()
);

comment on table measure.mcp_auth_codes is 'short-lived OAuth 2.0 authorization codes for MCP (10 min TTL)';
comment on column measure.mcp_auth_codes.id is 'unique internal identifier';
comment on column measure.mcp_auth_codes.code is 'random authorization code sent to the MCP client';
comment on column measure.mcp_auth_codes.user_id is 'the authenticated Measure user this code belongs to';
comment on column measure.mcp_auth_codes.client_id is 'the MCP client that initiated the authorization';
comment on column measure.mcp_auth_codes.redirect_uri is 'redirect URI provided during authorization';
comment on column measure.mcp_auth_codes.code_challenge is 'PKCE S256 code challenge; required for all clients';
comment on column measure.mcp_auth_codes.provider is 'OAuth provider name (github, google)';
comment on column measure.mcp_auth_codes.provider_token is 'OAuth token from the third-party provider (GitHub, Google, etc.)';
comment on column measure.mcp_auth_codes.expires_at is 'expiration timestamp; codes are valid for 10 minutes';
comment on column measure.mcp_auth_codes.used is 'true once exchanged for a token; prevents replay';
comment on column measure.mcp_auth_codes.created_at is 'timestamp when this code was created';

-- migrate:down
drop table if exists measure.mcp_auth_codes;