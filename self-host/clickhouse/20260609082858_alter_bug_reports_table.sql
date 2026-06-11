-- migrate:up
alter table bug_reports
  comment column if exists `status` 'status of the bug report 0 (Open) or 1 (Closed)';

-- migrate:down
alter table bug_reports
  comment column if exists `status` 'status of the bug report 0 (Closed) or 1 (Open)';
