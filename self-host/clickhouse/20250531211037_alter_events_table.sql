-- migrate:up
alter table events
materialize index if exists user_defined_attribute_key_bloom_idx,
materialize index if exists user_defined_attribute_key_minmax_idx;

-- migrate:down
alter table events
clear index if exists user_defined_attribute_key_bloom_idx,
clear index if exists user_defined_attribute_key_minmax_idx;
