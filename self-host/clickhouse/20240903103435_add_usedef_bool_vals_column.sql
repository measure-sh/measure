-- migrate:up
alter table events add column if not exists `usedef_attrs.bool_vals` Array(Bool) after `usedef_attrs.string_vals`;

-- migrate:down
drop column if exists `usedef_attrs.bool_vals`;
