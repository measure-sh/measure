-- migrate:up
alter table events
comment column if exists `bug_report.description` 'description of the bug report';

-- migrate:down
alter table events
modify column if exists `bug_report.description` remove comment;
