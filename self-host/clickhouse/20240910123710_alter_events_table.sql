-- migrate:up
alter table events
add column if not exists `attribute.os_page_size` UInt8 after `attribute.os_version`, comment column `attribute.os_page_size` 'memory page size';

-- migrate:down
alter table events
drop column if exists `attribute.os_page_size`;
