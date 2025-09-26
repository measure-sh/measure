-- migrate:up

CREATE TABLE IF NOT EXISTS ai_metrics (
    team_id UUID NOT NULL COMMENT 'linked team id' CODEC(ZSTD(3)),
    timestamp DateTime64(3, 'UTC') NOT NULL COMMENT 'timestamp of ai usage' CODEC(DoubleDelta, ZSTD(3)),
    user_id String NOT NULL COMMENT 'user id of the user interacting with the ai' CODEC(ZSTD(3)),
    source String NOT NULL COMMENT 'source of the ai interaction' CODEC(ZSTD(3)),
    model String NOT NULL COMMENT 'model used for the ai interaction' CODEC(ZSTD(3)),
    input_token_count AggregateFunction(sum, UInt32) COMMENT 'aggregated number of input tokens ingested' CODEC(ZSTD(3)),
    output_token_count AggregateFunction(sum, UInt32) COMMENT 'aggregated number of output tokens ingested' CODEC(ZSTD(3))
)
ENGINE = AggregatingMergeTree()
ORDER BY (team_id, timestamp)
PARTITION BY toYYYYMM(timestamp);

-- migrate:down

DROP TABLE IF EXISTS ai_metrics;