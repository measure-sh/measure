-- migrate:up
alter table events
materialize index if exists exception_fingerprint_bloom_idx,
materialize index if exists anr_fingerprint_bloom_idx;

-- migrate:down
alter table events
clear index if exists exception_fingerprint_bloom_idx,
clear index if exists anr_fingerprint_bloom_idx;
