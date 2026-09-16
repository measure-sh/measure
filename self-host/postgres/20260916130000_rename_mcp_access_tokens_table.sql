-- migrate:up

delete from measure.mcp_access_tokens;

alter table measure.mcp_access_tokens rename to mcp_auth_sessions;

alter table measure.mcp_auth_sessions
    drop column if exists token_hash,
    drop column if exists expires_at,
    drop column if exists revoked,
    drop column if exists last_used_at,
    add column rt_jti uuid not null,
    add column at_expiry_at timestamptz not null,
    add column rt_expiry_at timestamptz not null;

alter table measure.mcp_auth_sessions alter column id drop default;

alter index measure.mcp_access_tokens_pkey rename to mcp_auth_sessions_pkey;
alter table measure.mcp_auth_sessions rename constraint mcp_access_tokens_user_id_fkey to mcp_auth_sessions_user_id_fkey;

comment on table measure.mcp_auth_sessions is 'table storing MCP auth sessions';
comment on column measure.mcp_auth_sessions.id is 'unique internal identifier';
comment on column measure.mcp_auth_sessions.user_id is 'the Measure user this session authenticates';
comment on column measure.mcp_auth_sessions.client_id is 'the MCP client this session was opened for';
comment on column measure.mcp_auth_sessions.provider is 'OAuth provider name';
comment on column measure.mcp_auth_sessions.provider_token is 'third-party OAuth token bound to this session';
comment on column measure.mcp_auth_sessions.provider_token_checked_at is 'last time the provider token was validated';
comment on column measure.mcp_auth_sessions.rt_jti is 'jti claim of the live refresh token';
comment on column measure.mcp_auth_sessions.at_expiry_at is 'expiry of the access tokens minted from this session';
comment on column measure.mcp_auth_sessions.rt_expiry_at is 'expiry of the refresh token';
comment on column measure.mcp_auth_sessions.created_at is 'timestamp when this session was opened';

-- migrate:down
delete from measure.mcp_auth_sessions;

alter table measure.mcp_auth_sessions
    drop column if exists rt_jti,
    drop column if exists at_expiry_at,
    drop column if exists rt_expiry_at,
    add column token_hash text not null,
    add column expires_at timestamptz not null,
    add column revoked boolean not null default false,
    add column last_used_at timestamptz;

alter index measure.mcp_auth_sessions_pkey rename to mcp_access_tokens_pkey;
alter table measure.mcp_auth_sessions rename constraint mcp_auth_sessions_user_id_fkey to mcp_access_tokens_user_id_fkey;

alter table measure.mcp_auth_sessions alter column id set default gen_random_uuid();
alter table measure.mcp_auth_sessions add constraint mcp_access_tokens_token_hash_key unique (token_hash);
create index mcp_access_tokens_token_hash_idx on measure.mcp_auth_sessions(token_hash) where not revoked;

alter table measure.mcp_auth_sessions rename to mcp_access_tokens;
comment on table measure.mcp_access_tokens is 'long-lived MCP bearer tokens (90 day expiry)';
