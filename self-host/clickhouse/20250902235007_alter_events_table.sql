-- migrate:up
alter table events
comment column if exists `custom.name` 'name of the custom event';

-- migrate:down
alter table events
modify column if exists `custom.name` remove comment;
