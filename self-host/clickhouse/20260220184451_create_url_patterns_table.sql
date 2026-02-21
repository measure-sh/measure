-- migrate:up
CREATE TABLE url_patterns
(
    `team_id` UUID,
    `app_id` UUID,
    `domain` String,
    `path` String,
    `last_accessed_at` DateTime
)
ENGINE = ReplacingMergeTree(last_accessed_at)
ORDER BY (team_id, app_id, domain, path)
TTL last_accessed_at + INTERVAL 30 DAY

-- migrate:down
DROP TABLE IF EXISTS url_patterns
