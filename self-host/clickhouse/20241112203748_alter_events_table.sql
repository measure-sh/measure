-- migrate:up
alter table events
  add column if not exists user_defined_attribute Map(LowCardinality(String), Tuple(Enum('string' = 1, 'int64', 'float64', 'bool'), String)) codec(ZSTD(3)) after `attribute.network_provider`,
  comment column if exists user_defined_attribute 'user defined attributes',
  add index if not exists user_defined_attribute_key_bloom_idx mapKeys(user_defined_attribute) type bloom_filter(0.01) granularity 16,
  add index if not exists user_defined_attribute_key_minmax_idx mapKeys(user_defined_attribute) type minmax granularity 16,
  materialize index if exists user_defined_attribute_key_bloom_idx,
  materialize index if exists user_defined_attribute_key_minmax_idx;


-- migrate:down
alter table events
  drop column if exists user_defined_attribute,
  drop index if exists user_defined_attribute_key_bloom_idx,
  drop index if exists user_defined_attribute_key_minmax_idx;
