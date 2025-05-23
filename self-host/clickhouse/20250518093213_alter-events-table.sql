-- migrate:up
alter table events
  add column if not exists `exception.framework` FixedString(16) after `exception.foreground`,
  comment column if exists `exception.framework` 'the framework in which the exception was thrown';

-- migrate:down
alter table events
  drop column if exists `exception.framework`;
