-- migrate:up
alter table sessions
materialize index if exists user_id_bloom_idx;

-- migrate:down
alter table sessions
clear index if exists user_id_bloom_idx;
