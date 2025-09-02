-- migrate:up
alter table spans
materialize index if exists user_defined_attribute_key_bloom_idx,
materialize index if exists user_defined_attribute_key_minmax_idx;

-- migrate:down
alter table spans
clear index if exists user_defined_attribute_key_bloom_idx,
clear index if exists user_defined_attribute_key_minmax_idx;
