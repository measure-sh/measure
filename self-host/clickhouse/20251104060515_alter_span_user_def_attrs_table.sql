-- migrate:up
alter table span_user_def_attrs
add column if not exists team_id UUID CODEC(ZSTD(3)) first;


-- migrate:down
alter table span_user_def_attrs
drop column if exists team_id;
