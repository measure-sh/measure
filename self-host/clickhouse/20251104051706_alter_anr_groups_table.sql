-- migrate:up
alter table anr_groups
add column if not exists team_id UUID CODEC(ZSTD(3)) first;

-- migrate:down
alter table anr_groups
drop column if exists team_id;
