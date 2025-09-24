-- migrate:up
alter table sessions
    add index if not exists first_event_timestamp_minmax_idx `first_event_timestamp` type minmax granularity 4,
    add index if not exists last_event_timestamp_minmax_idx `last_event_timestamp` type minmax granularity 4,
    add index if not exists user_id_bloom_idx `user_id` type minmax granularity 2;

-- migrate:down
alter table sessions
    drop index if exists first_event_timestamp_minmax_idx,
    drop index if exists last_event_timestamp_minmax_idx,
    drop index if exists user_id_bloom_idx;
