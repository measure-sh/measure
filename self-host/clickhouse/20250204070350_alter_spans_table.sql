-- migrate:up
alter table spans
  add column if not exists user_defined_attribute Map(LowCardinality(String), Tuple(Enum('string' = 1, 'int64', 'float64', 'bool'), String)) codec(ZSTD(3)) after `attribute.device_thermal_throttling_enabled`,
  add index if not exists user_defined_attribute_key_bloom_idx mapKeys(user_defined_attribute) type bloom_filter(0.01) granularity 16,
  add index if not exists user_defined_attribute_key_minmax_idx mapKeys(user_defined_attribute) type minmax granularity 16;


-- migrate:down
alter table spans
  drop column if exists user_defined_attribute,
  drop index if exists user_defined_attribute_key_bloom_idx,
  drop index if exists user_defined_attribute_key_minmax_idx;
