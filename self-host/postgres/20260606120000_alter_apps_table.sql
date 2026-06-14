-- migrate:up
alter table if exists measure.apps
drop constraint if exists apps_os_name_check;

alter table if exists measure.apps
add column if not exists os_names text[] not null default '{}';

update measure.apps
set os_names = array[os_name]
where os_name is not null and os_name <> '';

alter table if exists measure.apps
drop column if exists os_name;

-- os_names must hold values of a single OS family (ios and ipados together
-- form the apple family). This is enforced in ingest code. We deliberate dropped this
-- as a constraint as we need to support more OS names in the future wihout having to runs
-- migrations.
comment on column measure.apps.os_names is 'names of the operating systems the app runs on (single family)';

-- migrate:down
alter table if exists measure.apps
add column if not exists os_name varchar(256);

update measure.apps
set os_name = os_names[1]
where cardinality(os_names) > 0;

alter table if exists measure.apps
drop column if exists os_names;

alter table if exists measure.apps
add constraint apps_os_name_check check (
  os_name::text = any (array['ios', 'android', 'flutter', 'react-native', 'unity', 'ipados']::text[])
);
