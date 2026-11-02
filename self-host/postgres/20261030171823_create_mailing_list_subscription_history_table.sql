-- migrate:up
create table if not exists measure.mailing_list_subscription_history (
    id uuid primary key not null default gen_random_uuid(),
    contact_id uuid not null references measure.mailing_list_contacts(id) on delete cascade,
    list_id text not null,
    subscribed boolean not null,
    attribution text,
    changed_at timestamptz not null default now()
);

create index if not exists mailing_list_subscription_history_contact_id_changed_at_idx
    on measure.mailing_list_subscription_history (contact_id, changed_at);

comment on table measure.mailing_list_subscription_history is 'history of changes made to each contact''s mailing list subscriptions';
comment on column measure.mailing_list_subscription_history.id is 'unique id for each change';
comment on column measure.mailing_list_subscription_history.contact_id is 'id of the contact whose subscription changed';
comment on column measure.mailing_list_subscription_history.list_id is 'id of the mailing list that was subscribed to or unsubscribed from';
comment on column measure.mailing_list_subscription_history.subscribed is 'true for a subscribe, false for an unsubscribe';
comment on column measure.mailing_list_subscription_history.attribution is 'where the change was made';
comment on column measure.mailing_list_subscription_history.changed_at is 'utc timestamp of the change';

-- migrate:down
drop table if exists measure.mailing_list_subscription_history;
