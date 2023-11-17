-- migrate:up
create table if not exists public.sessions (
    id uuid primary key not null,
    app_id uuid references public.apps(id) on delete cascade,
    event_count int default 0,
    attachment_count int default 0,
    bytes_in int default 0,
    symbolication_attempts_count int default 0,
    timestamp timestamptz not null
);

comment on column public.sessions.id is 'unique uuidv4 session id';
comment on column public.sessions.app_id is 'app id of the app this session belongs to';
comment on column public.sessions.event_count is 'number of events in the session';
comment on column public.sessions.attachment_count is 'number of attachments in the session';
comment on column public.sessions.bytes_in is 'total session payload size in bytes';
comment on column public.sessions.symbolication_attempts_count is 'number of times symbolication was attempted for this session';
comment on column public.sessions.timestamp is 'utc timestamp at the time of session ingestion';

-- migrate:down
drop table if exists public.sessions;
