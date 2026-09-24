-- migrate:up
alter table measure.auth_sessions
    add column if not exists rt_jti uuid,
    add column if not exists prev_rt_jti uuid,
    add column if not exists rt_rotated_at timestamptz;

update measure.auth_sessions set rt_jti = id where rt_jti is null;

alter table measure.auth_sessions alter column rt_jti set not null;

comment on column measure.auth_sessions.rt_jti is 'jti claim of the live refresh token';
comment on column measure.auth_sessions.prev_rt_jti is 'jti claim of the refresh token replaced by the last rotation';
comment on column measure.auth_sessions.rt_rotated_at is 'timestamp of the last refresh token rotation';

-- migrate:down
alter table measure.auth_sessions
    drop column if exists rt_jti,
    drop column if exists prev_rt_jti,
    drop column if exists rt_rotated_at;
