-- migrate:up
CREATE TABLE IF NOT EXISTS url_patterns (
    `id` UUID NOT NULL COMMENT 'unique url pattern id' CODEC(ZSTD(3)),
    `team_id` UUID NOT NULL COMMENT 'linked team id' CODEC(ZSTD(3)),
    `app_id` UUID NOT NULL COMMENT 'linked app id' CODEC(ZSTD(3)),
    `pattern` String NOT NULL COMMENT 'the url pattern' CODEC(ZSTD(3)),
    `created_at` DateTime64(9, 'UTC') NOT NULL COMMENT 'utc timestamp at the time of creation' CODEC(DoubleDelta, ZSTD(3)),
    `created_by` UUID NOT NULL COMMENT 'user id who created the record' CODEC(ZSTD(3)),
    `updated_by` UUID NOT NULL COMMENT 'user id who last updated the record' CODEC(ZSTD(3)),
    `last_seen_at` DateTime64(9, 'UTC') NOT NULL COMMENT 'utc timestamp when this url pattern was last seen' CODEC(DoubleDelta, ZSTD(3)),
    `is_blocked` Bool NOT NULL COMMENT 'true if this url pattern is blocked' CODEC(ZSTD(3))
) ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (team_id, app_id, id)

-- migrate:down
DROP TABLE IF EXISTS url_patterns;
