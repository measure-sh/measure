-- migrate:up
create table if not exists public.unhandled_exception_groups (
    id uuid primary key not null,
    app_id uuid references public.apps(id) on delete cascade,
    name text not null,
    fingerprint varchar(16) not null,
    event_ids uuid[] not null,
    first_event_timestamp timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column public.unhandled_exception_groups.id is 'sortable unique id (uuidv7) for each unhandled exception group';
comment on column public.unhandled_exception_groups.app_id is 'linked app id';
comment on column public.unhandled_exception_groups.name is 'name of the exception for easy identification';
comment on column public.unhandled_exception_groups.fingerprint is 'fingerprint of the unhandled exception';
comment on column public.unhandled_exception_groups.event_ids is 'list of associated event ids';
comment on column public.unhandled_exception_groups.first_event_timestamp is 'utc timestamp of the oldest event in the group';
comment on column public.unhandled_exception_groups.created_at is 'utc timestamp at the time of record creation';
comment on column public.unhandled_exception_groups.updated_at is 'utc timestamp at the time of record updation';

-- migrate:down
drop table if exists public.unhandled_exception_groups;