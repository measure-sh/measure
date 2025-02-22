-- migrate:up
alter table events
    add column if not exists `bug_report.description` String after `screen_view.name`, comment column `bug_report.description` 'description of the bug report';


-- migrate:down
alter table events
  drop column if exists `bug_report.description`;
