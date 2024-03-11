-- migrate:up
create table if not exists public.build_sizes (
    id uuid primary key not null default gen_random_uuid(),
    app_id uuid references public.apps(id) on delete cascade,
    version_name varchar(256) not null,
    version_code varchar(256) not null,
    build_size int default 0,
    created_at timestamptz not null default now()
);

comment on column public.build_sizes.id is 'unique id for each build size';
comment on column public.build_sizes.app_id is 'linked app id';
comment on column public.build_sizes.version_name is 'user visible version number of the app';
comment on column public.build_sizes.version_code is 'incremental build number of the app';
comment on column public.build_sizes.build_size is 'build size of the app';
comment on column public.build_sizes.created_at is 'utc timestamp at the time of record creation';

-- migrate:down
drop table if exists public.build_sizes;