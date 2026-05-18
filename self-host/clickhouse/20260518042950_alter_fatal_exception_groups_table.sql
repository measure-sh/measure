-- migrate:up
alter table fatal_exception_groups
  add index if not exists handled_bloom_idx handled TYPE bloom_filter(0.01) GRANULARITY 1 after id_bloom_idx,
  add index if not exists is_custom_bloom_idx is_custom TYPE bloom_filter(0.01) GRANULARITY 1 after handled_bloom_idx
settings mutations_sync = 2;

-- migrate:down
alter table fatal_exception_groups
  drop index if exists handled_bloom_idx,
  drop index if exists is_custom_bloom_idx
settings mutations_sync = 2;
