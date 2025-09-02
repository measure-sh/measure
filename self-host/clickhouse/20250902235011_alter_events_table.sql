-- migrate:up
alter table events
materialize index if exists custom_name_bloom_idx;

-- migrate:down
alter table events
clear index if exists custom_name_bloom_idx;
