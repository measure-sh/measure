-- migrate:up
create table if not exists measure.event_reqs (
    id uuid primary key not null,
    app_id uuid references measure.apps(id) on delete cascade,
    event_count int default 0,
    attachment_count int default 0,
    session_count int default 0,
    bytes_in int default 0,
    symbolication_attempts_count int default 0,
    created_at timestamptz not null default now()
);

comment on column measure.event_reqs.id is 'id of the event request';
comment on column measure.event_reqs.app_id is 'id of the associated app';
comment on column measure.event_reqs.event_count is 'number of events in the event request';
comment on column measure.event_reqs.attachment_count is 'number of attachments in the event request';
comment on column measure.event_reqs.session_count is 'number of sessions in the event request';
comment on column measure.event_reqs.bytes_in is 'total payload size of the request';
comment on column measure.event_reqs.symbolication_attempts_count is 'number of times symbolication was attempted for this event request';
comment on column measure.event_reqs.created_at is 'utc timestamp at the time of record creation';

-- migrate:down
drop table if exists measure.event_reqs;
