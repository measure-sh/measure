-- migrate:up
alter table sessions
add column if not exists team_id UUID CODEC(ZSTD(3)) first;


-- migrate:down
alter table sessions
drop column if exists team_id;
