-- migrate:up
alter table events
    add column if not exists `exception.binary_images` String after `exception.foreground`,
    comment column `exception.binary_images` 'list of apple crash binary images';


-- migrate:down
alter table events
  drop column if exists `exception.binary_images`;
