-- migrate:up
alter table sessions
materialize index if exists first_event_timestamp_minmax_idx,
materialize index if exists last_event_timestamp_minmax_idx,
materialize index if exists user_id_bloom_idx;

-- migrate:down
alter table sessions
clear index if exists first_event_timestamp_minmax_idx,
clear index if exists last_event_timestamp_minmax_idx,
clear index if exists user_id_bloom_idx;
