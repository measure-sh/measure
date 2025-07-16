-- migrate:up
alter table events
  comment column if exists `exception.error` 'general error data';

-- migrate:down
alter table events
  modify column if exists `exception.error` remove comment;
