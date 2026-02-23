-- migrate:up
CREATE TABLE url_patterns
(
    `team_id` UUID comment 'The team this URL pattern belongs to',
    `app_id` UUID comment 'The app this URL pattern belongs to',
    `domain` String comment 'The domain of the URL pattern, e.g. "example.com"',
    `path` String comment 'The path of the URL pattern, e.g. "/users/*/profile"',
    `last_updated_at` DateTime comment 'The last time this URL pattern was last updated'
)
ENGINE = ReplacingMergeTree(last_updated_at)
ORDER BY (team_id, app_id, domain, path)
TTL last_updated_at + INTERVAL 30 DAY

-- migrate:down
DROP TABLE IF EXISTS url_patterns
