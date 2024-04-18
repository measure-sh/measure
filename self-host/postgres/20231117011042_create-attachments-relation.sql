-- migrate:up
create table if not exists public.attachments (
    id uuid primary key not null,
    event_id uuid not null,
    session_id uuid references public.sessions(id) on delete cascade,
    key varchar(256) not null,
    location varchar not null,
    timestamp timestamptz not null
);

comment on column public.sessions_attachments.id is 'unique id of the attachment';
comment on column public.sessions_attachments.event_id is 'event id of the event the attachment belongs to';
comment on column public.sessions_attachments.session_id is 'session id of the containing session';
comment on column public.sessions_attachments.key is 'key of the attachment file stored in remote object store';
comment on column public.sessions_attachments.location is 'url of the attachment file stored in remote object store';
comment on column public.sessions_attachments.timestamp is 'utc timestamp at the time of attachment file upload';

-- migrate:down
drop table if exists public.attachments;