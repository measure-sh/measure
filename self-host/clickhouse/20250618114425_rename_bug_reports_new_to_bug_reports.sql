-- migrate:up

rename table bug_reports_new to bug_reports;

-- migrate:down

rename table bug_reports to bug_reports_new;