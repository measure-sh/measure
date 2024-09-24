-- migrate:up
alter table events
  add column if not exists `lifecycle_fragment.parent_fragment` String after `lifecycle_fragment.parent_activity`,
  comment column `lifecycle_fragment.parent_fragment` 'fully qualified class name of the parent fragment that the fragment is attached to';

-- migrate:down
alter table events
  drop column if exists `lifecycle_fragment.parent_fragment`;

