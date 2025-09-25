-- migrate:up
alter table events
  add column if not exists `layout_snapshot` String CODEC(ZSTD(3)) after `custom.name`;

-- migrate:down
alter table events
drop column if exists `layout_snapshot`;
