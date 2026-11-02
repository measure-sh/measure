-- migrate:up
create table if not exists measure.mailing_list_subscriptions (
    subscriber_id uuid not null references measure.mailing_list_subscribers(id) on delete cascade,
    list_id text not null,
    subscribed boolean not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (subscriber_id, list_id)
);

create index if not exists mailing_list_subscriptions_list_id_subscribed_idx
    on measure.mailing_list_subscriptions (list_id, subscribed);

comment on table measure.mailing_list_subscriptions is 'table storing whether each subscriber is subscribed to each mailing list';
comment on column measure.mailing_list_subscriptions.subscriber_id is 'id of the subscriber';
comment on column measure.mailing_list_subscriptions.list_id is 'id of the mailing list, like newsletter';
comment on column measure.mailing_list_subscriptions.subscribed is 'whether the subscriber is currently subscribed to the list';
comment on column measure.mailing_list_subscriptions.created_at is 'utc timestamp at the time of the first subscription to the list';
comment on column measure.mailing_list_subscriptions.updated_at is 'utc timestamp at the time of the last change';

-- migrate:down
drop table if exists measure.mailing_list_subscriptions;
