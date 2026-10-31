-- migrate:up
create table if not exists measure.mailing_list_subscribe_events (
    id uuid primary key not null default gen_random_uuid(),
    subscriber_id uuid not null references measure.mailing_list_subscribers(id) on delete cascade,
    subscribed boolean not null,
    source text not null,
    attribution text,
    created_at timestamptz not null default now()
);

create index if not exists mailing_list_subscribe_events_subscriber_id_created_at_idx
    on measure.mailing_list_subscribe_events (subscriber_id, created_at);

comment on table measure.mailing_list_subscribe_events is 'table storing every subscribe and unsubscribe of a marketing email subscriber';
comment on column measure.mailing_list_subscribe_events.id is 'unique id for each event';
comment on column measure.mailing_list_subscribe_events.subscriber_id is 'id of the subscriber the event belongs to';
comment on column measure.mailing_list_subscribe_events.subscribed is 'true for a subscribe, false for an unsubscribe';
comment on column measure.mailing_list_subscribe_events.source is 'who made the change';
comment on column measure.mailing_list_subscribe_events.attribution is 'where the change was made';
comment on column measure.mailing_list_subscribe_events.created_at is 'utc timestamp at the time of the event';

-- migrate:down
drop table if exists measure.mailing_list_subscribe_events;
