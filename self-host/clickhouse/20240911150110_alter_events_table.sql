-- migrate:up
alter table events
add column if not exists `lifecycle_fragment.parent_fragment` String after `lifecycle_fragment.parent_activity`;

-- migrate:down
alter table events
drop column if exists `lifecycle_fragment.parent_fragment`;
