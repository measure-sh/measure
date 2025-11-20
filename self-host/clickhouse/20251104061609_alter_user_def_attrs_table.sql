-- migrate:up
alter table user_def_attrs
add column if not exists team_id UUID CODEC(ZSTD(3)) first;


-- migrate:down
alter table user_def_attrs
drop column if exists team_id;
