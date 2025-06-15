-- migrate:up
alter table events
  add column if not exists `exception.error` String after `exception.binary_images`;

-- migrate:down
alter table events
  drop column if exists `exception.error`;
