-- migrate:up
alter table sessions
  comment column if exists `start_time` 'Start time of the session',
  comment column if exists `end_time` 'End time of the session';

-- migrate:down
alter table sessions
  modify column if exists `start_time` remove comment,
  modify column if exists `end_time` remove comment;
