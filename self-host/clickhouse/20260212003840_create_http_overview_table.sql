-- migrate:up
CREATE TABLE measure.http_overview (
    team_id String,
    app_id String,
    origin LowCardinality(String),
    path String,
    bucket DateTime CODEC(DoubleDelta, ZSTD(3)),

    count SimpleAggregateFunction(sum, UInt64),
    error_count SimpleAggregateFunction(sum, UInt64),
    duration_quantile AggregateFunction(quantile(0.95), UInt64)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(bucket)
ORDER BY (team_id, app_id, bucket, origin, path)

-- migrate:down
DROP TABLE IF EXISTS measure.http_overview;
