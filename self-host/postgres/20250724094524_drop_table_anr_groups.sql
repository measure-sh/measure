-- migrate:up
drop table if exists public.anr_groups;

-- migrate:down
create table if not exists public.anr_groups (
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

comment on column public.anr_groups.id is 'sortable unique id (uuidv7) for each anr group';
comment on column public.anr_groups.app_id is 'linked app id';
comment on column public.anr_groups.type is 'type of the anr';
comment on column public.anr_groups.message is 'message of the anr';
comment on column public.anr_groups.method_name is 'method name where the anr occured';
comment on column public.anr_groups.file_name is 'file name where the anr occured';
comment on column public.anr_groups.line_number is 'line number where the anr occured';
comment on column public.anr_groups.fingerprint is 'fingerprint of the anr';
comment on column public.anr_groups.first_event_timestamp is 'utc timestamp of the oldest event in the group';
comment on column public.anr_groups.created_at is 'utc timestamp at the time of record creation';
comment on column public.anr_groups.updated_at is 'utc timestamp at the time of record updation';
