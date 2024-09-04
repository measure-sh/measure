-- migrate:up
alter table events add column if not exists `usedef_attrs.keys` Array(String) after `navigation.source`;

-- migrate:down
drop column if exists `usedef_attrs.keys`;
