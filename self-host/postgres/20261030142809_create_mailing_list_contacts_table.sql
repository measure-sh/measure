-- migrate:up
create table if not exists measure.mailing_list_contacts (
    id uuid primary key not null default gen_random_uuid(),
    email text not null unique,
    confirmation_token_hash text unique,
    confirmation_expires_at timestamptz,
    confirmation_list_id text,
    confirmation_attribution text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table measure.mailing_list_contacts is 'table storing each email address known to the mailing lists, and its pending confirmation';
comment on column measure.mailing_list_contacts.id is 'unique id for each contact';
comment on column measure.mailing_list_contacts.email is 'lowercased email address of the contact';
comment on column measure.mailing_list_contacts.confirmation_token_hash is 'sha-256 hash of the pending confirmation token';
comment on column measure.mailing_list_contacts.confirmation_expires_at is 'utc timestamp at which the pending confirmation token expires';
comment on column measure.mailing_list_contacts.confirmation_list_id is 'id of the mailing list of the pending subscription request';
comment on column measure.mailing_list_contacts.confirmation_attribution is 'attribution of the pending subscription request';
comment on column measure.mailing_list_contacts.created_at is 'utc timestamp at the time of contact creation';
comment on column measure.mailing_list_contacts.updated_at is 'utc timestamp at the time of contact update';

-- migrate:down
drop table if exists measure.mailing_list_contacts;
