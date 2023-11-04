create table if not exists sessions_attachments (
    id uuid primary key not null,
    session_id uuid references sessions(id) on delete cascade,
    name varchar(256) not null,
    extension varchar(32) not null,
    type varchar(32) not null,
    key varchar(256) not null,
    location varchar not null,
    timestamp timestamptz not null
);

comment on column sessions_attachments.id is 'unique id for each session attachment';
comment on column sessions_attachments.session_id is 'session_id of the containing session';
comment on column sessions_attachments.name is 'original name of the attachment file';
comment on column sessions_attachments.extension is 'original extension of the attachment file';
comment on column sessions_attachments.type is 'type of attachment, like screenshot etc';
comment on column sessions_attachments.key is 'key of the attachment file stored in remote object store';
comment on column sessions_attachments.location is 'url of the attachment file stored in remote object store';
comment on column sessions_attachments.timestamp is 'utc timestamp at the time of attachment file upload';