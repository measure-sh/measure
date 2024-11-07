-- migrate:up
alter table sessions
    drop index if exists user_id_bloom_idx;


-- migrate:down
alter table sessions
    add index if not exists user_id_bloom_idx `user_id` type minmax granularity 2,
    materialize index if exists user_id_bloom_idx;
