-- migrate:up
alter table events
comment column if exists `attribute.os_page_size` 'memory_page_size';

-- migrate:down
alter table events
modify column if exists `attribute.os_page_size` remove comment;
