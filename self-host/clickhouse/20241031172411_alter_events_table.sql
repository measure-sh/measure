-- migrate:up
alter table events
  add index if not exists exception_fingerprint_bloom_idx `exception.fingerprint` type bloom_filter granularity 4,
  add index if not exists anr_fingerprint_bloom_idx `anr.fingerprint` type bloom_filter granularity 4;

-- migrate:down
alter table events
  drop index if exists exception_fingerprint_bloom_idx,
  drop index if exists anr_fingerprint_bloom_idx;
