-- migrate:up
alter table bug_reports
add column if not exists team_id UUID CODEC(ZSTD(3)) first;


-- migrate:down
alter table bug_reports
drop column if exists team_id;
