-- migrate:up
alter table if exists measure.apps
rename column platform to os_name;

comment on column measure.apps.os_name is 'name of the operating system';

-- migrate:down
alter table if exists measure.apps
rename column os_name to platform;
