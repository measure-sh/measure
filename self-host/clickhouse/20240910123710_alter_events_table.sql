-- migrate:up
alter table events
  add column if not exists `attribute.os_page_size` UInt8 after `attribute.os_version`;

-- migrate:down
alter table events
drop column if exists `attribute.os_page_size`;
