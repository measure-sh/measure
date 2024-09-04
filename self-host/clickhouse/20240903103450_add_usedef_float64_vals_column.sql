-- migrate:up
alter table events add column if not exists `usedef_attrs.float64_vals` Array(Float64) after `usedef_attrs.int64_vals`;

-- migrate:down
drop column if exists `usedef_attrs.float64_vals`;
