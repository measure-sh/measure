-- migrate:up
create table if not exists measure.mcp_access_tokens (
    id           uuid primary key not null default gen_random_uuid(),
    token_hash   text not null unique,
    user_id      uuid not null references measure.users(id) on delete cascade,
    client_id    text not null,
    expires_at   timestamptz not null,
    provider     text,
    provider_token text,
    provider_token_checked_at timestamptz,
    last_used_at timestamptz,
    revoked      boolean not null default false,
    created_at   timestamptz not null default now()
);
create index on measure.mcp_access_tokens(token_hash) where not revoked;
comment on table measure.mcp_access_tokens is 'long-lived MCP bearer tokens (90 day expiry)';
comment on column measure.mcp_access_tokens.id is 'unique internal identifier';
comment on column measure.mcp_access_tokens.token_hash is 'sha256 of raw token; format: msr_<base64url(32 random bytes)>';
comment on column measure.mcp_access_tokens.user_id is 'the Measure user this token authenticates';
comment on column measure.mcp_access_tokens.client_id is 'the MCP client this token was issued to';
comment on column measure.mcp_access_tokens.expires_at is 'expiration timestamp; tokens are valid for 90 days';
comment on column measure.mcp_access_tokens.provider is 'OAuth provider name (github, google, etc.)';
comment on column measure.mcp_access_tokens.provider_token is 'third-party OAuth token bound to this MCP session';
comment on column measure.mcp_access_tokens.provider_token_checked_at is 'last time the provider token was validated';
comment on column measure.mcp_access_tokens.last_used_at is 'last time this token was used to make an MCP request';
comment on column measure.mcp_access_tokens.revoked is 'true if token has been revoked; checked on every request';
comment on column measure.mcp_access_tokens.created_at is 'timestamp when this token was issued';

-- migrate:down
drop table if exists measure.mcp_access_tokens;