-- migrate:up
create table if not exists public.unhandled_exception_groups (
    id uuid primary key not null default gen_random_uuid(),
    app_id uuid references public.apps(id) on delete cascade,
    name text not null,
    fingerprint varchar(16) not null,
    count integer not null,
    eventids uuid[] not null,
    last_seen timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column public.unhandled_exception_groups.id is 'unique id for each unhandled exception group';
comment on column public.unhandled_exception_groups.app_id is 'linked app id';
comment on column public.unhandled_exception_groups.name is 'name of the exception for easy identification';
comment on column public.unhandled_exception_groups.fingerprint is 'fingerprint of the unhandled exception';
comment on column public.unhandled_exception_groups.count is 'number of instances this unhandled exception was observed';
comment on column public.unhandled_exception_groups.eventids is 'list of associated event ids';
comment on column public.unhandled_exception_groups.created_at is 'utc timestamp at the time of record creation';
comment on column public.unhandled_exception_groups.updated_at is 'utc timestamp at the time of record updation';

-- migrate:down
drop table if exists public.unhandled_exception_groups;
