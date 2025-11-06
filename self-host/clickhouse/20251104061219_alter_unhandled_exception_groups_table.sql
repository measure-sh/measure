-- migrate:up
alter table unhandled_exception_groups
add column if not exists team_id UUID CODEC(ZSTD(3)) first;


-- migrate:down
alter table unhandled_exception_groups
drop column if exists team_id;
