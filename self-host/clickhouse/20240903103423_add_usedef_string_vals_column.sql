-- migrate:up
alter table events add column if not exists `usedef_attrs.string_vals` Array(String) after `usedef_attrs.types`;

-- migrate:down
drop column if exists `usedef_attrs.string_vals`;
