-- migrate:up
alter table events
comment column if exists `exception.binary_images` 'list of apple crash binary images';

-- migrate:down
alter table events
modify column if exists `exception.binary_images` remove comment;
