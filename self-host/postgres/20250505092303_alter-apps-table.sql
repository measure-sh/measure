-- migrate:up
alter table if exists public.apps
rename column platform to os_name;

comment on column public.apps.os_name is 'name of the operating system';

-- migrate:down
alter table if exists public.apps
rename column os_name to platform;