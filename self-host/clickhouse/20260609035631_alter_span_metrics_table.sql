-- migrate:up
alter table span_metrics
modify column if exists `p99` AggregateFunction(quantile(0.99), Int64) CODEC(ZSTD(3));

-- migrate:down
alter table span_metrics
modify column if exists `p99` AggregateFunction(quantile(0.5), Int64) CODEC(ZSTD(3));
