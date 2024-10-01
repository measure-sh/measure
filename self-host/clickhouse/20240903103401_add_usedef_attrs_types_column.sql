-- migrate:up
alter table events add column if not exists `usedef_attrs.types` Array(String) after `usedef_attrs.keys`;

-- migrate:down
drop column if exists `usedef_attrs.types`;
