-- migrate:up
create table if not exists measure.user_attribution (
    user_id uuid primary key references measure.users(id) on delete cascade,
    ga_client_id text null,
    gclid text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table measure.user_attribution is 'Marketing attribution identifiers captured at signup. 1:1 with users; row exists only when at least one identifier was captured.';

-- migrate:down
drop table if exists measure.user_attribution;
