-- migrate:up

rename table bug_reports to bug_reports_old;

-- migrate:down

rename table bug_reports_old to bug_reports;