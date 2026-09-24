-- migrate:up
alter table measure.mcp_auth_sessions
    add column if not exists prev_rt_jti uuid,
    add column if not exists rt_rotated_at timestamptz;

comment on column measure.mcp_auth_sessions.prev_rt_jti is 'jti claim of the refresh token replaced by the last rotation';
comment on column measure.mcp_auth_sessions.rt_rotated_at is 'timestamp of the last refresh token rotation';

-- migrate:down
alter table measure.mcp_auth_sessions
    drop column if exists prev_rt_jti,
    drop column if exists rt_rotated_at;
