-- migrate:up
alter table events
comment column if exists `exception.framework` 'the framework in which the exception was thrown';


-- migrate:down
alter table events
modify column if exists `exception.framework` remove comment;
