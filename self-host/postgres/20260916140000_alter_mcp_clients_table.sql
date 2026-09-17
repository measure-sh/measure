-- migrate:up
alter table measure.mcp_clients drop column if exists client_secret;

-- migrate:down
alter table measure.mcp_clients add column client_secret text not null default '';
alter table measure.mcp_clients alter column client_secret drop default;
comment on column measure.mcp_clients.client_secret is 'sha256 hash of raw client secret';
