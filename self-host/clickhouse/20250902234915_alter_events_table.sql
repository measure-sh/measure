-- migrate:up
alter table events
comment column if exists `lifecycle_fragment.parent_fragment` 'fully qualified class name of the parent fragment that the fragment is attached to';

-- migrate:down
alter table events
modify column if exists `lifecycle_fragment.parent_fragment` remove comment;
