-- migrate:up
create table if not exists measure.mailing_list_subscribers (
    id uuid primary key not null default gen_random_uuid(),
    email text not null unique,
    subscribed boolean not null default false,
    confirmation_token_hash text unique,
    confirmation_expires_at timestamptz,
    confirmation_attribution text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table measure.mailing_list_subscribers is 'table storing the current state of each marketing email subscriber';
comment on column measure.mailing_list_subscribers.id is 'unique id for each subscriber';
comment on column measure.mailing_list_subscribers.email is 'lowercased email address of the subscriber';
comment on column measure.mailing_list_subscribers.subscribed is 'whether the subscriber is currently subscribed';
comment on column measure.mailing_list_subscribers.confirmation_token_hash is 'sha-256 hash of the pending confirmation token';
comment on column measure.mailing_list_subscribers.confirmation_expires_at is 'utc timestamp at which the pending confirmation token expires';
comment on column measure.mailing_list_subscribers.confirmation_attribution is 'attribution of the pending subscription request';
comment on column measure.mailing_list_subscribers.created_at is 'utc timestamp at the time of subscriber creation';
comment on column measure.mailing_list_subscribers.updated_at is 'utc timestamp at the time of subscriber update';

-- migrate:down
drop table if exists measure.mailing_list_subscribers;
