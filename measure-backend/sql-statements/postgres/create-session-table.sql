create table if not exists sessions (
    id uuid primary key not null,
    event_count int default 0,
    attachment_count int default 0,
    bytes_in int default 0,
    symbolication_attempts_count int default 0,
    timestamp timestamptz not null
)

comment on column sessions.id is 'unique uuidv4 session id';
comment on column sessions.event_count is 'number of events in the session';
comment on column sessions.attachment_count is 'number of attachments in the session';
comment on column sessions.bytes_in is 'total session payload size in bytes';
comment on column sessions.symbolication_attempts_count is 'number of times symbolication was attempted for this session';
comment on column sessions.timestamp is 'utc timestamp at the time of session insertion';