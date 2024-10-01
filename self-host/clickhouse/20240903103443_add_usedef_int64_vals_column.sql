-- migrate:up
alter table events add column if not exists `usedef_attrs.int64_vals` Array(Int64) after `usedef_attrs.bool_vals`;

-- migrate:down
drop column if exists `usedef_attrs.int64_vals`;
