-- migrate:up
create table if not exists public.short_filters (
    code varchar(32) primary key not null,
    app_id uuid not null references public.apps(id) on delete cascade,
    filters JSONB not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column public.short_filters.code is 'short code hashed from filters';
comment on column public.short_filters.app_id is 'linked app id';
comment on column public.short_filters.filters is 'filters JSON';
comment on column public.short_filters.created_at is 'utc timestamp at the time of record creation';
comment on column public.short_filters.updated_at is 'utc timestamp at the time of record update';

-- migrate:down
drop table if exists public.short_filters;