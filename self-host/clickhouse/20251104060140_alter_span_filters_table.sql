-- migrate:up
alter table span_filters
add column if not exists team_id UUID CODEC(ZSTD(3)) first;


-- migrate:down
alter table span_filters
drop column if exists team_id;
