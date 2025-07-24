-- migrate:up
drop table if exists public.unhandled_exception_groups;

-- migrate:down
create table if not exists public.unhandled_exception_groups (
    id uuid primary key not null,
    app_id uuid references public.apps(id) on delete cascade,
    type text not null,
    message text not null,
    method_name text not null,
    file_name text not null,
    line_number int not null,
    fingerprint varchar(32) not null,
    first_event_timestamp timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column public.unhandled_exception_groups.id is 'sortable unique id (uuidv7) for each unhandled exception group';
comment on column public.unhandled_exception_groups.app_id is 'linked app id';
comment on column public.unhandled_exception_groups.type is 'type of the exception';
comment on column public.unhandled_exception_groups.message is 'message of the exception';
comment on column public.unhandled_exception_groups.method_name is 'method name where the exception occured';
comment on column public.unhandled_exception_groups.file_name is 'file name where the exception occured';
comment on column public.unhandled_exception_groups.line_number is 'line number where the exception occured';
comment on column public.unhandled_exception_groups.fingerprint is 'fingerprint of the unhandled exception';
comment on column public.unhandled_exception_groups.first_event_timestamp is 'utc timestamp of the oldest event in the group';
comment on column public.unhandled_exception_groups.created_at is 'utc timestamp at the time of record creation';
comment on column public.unhandled_exception_groups.updated_at is 'utc timestamp at the time of record updation';
