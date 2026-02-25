-- migrate:up
CREATE TABLE url_patterns
(
    `team_id` UUID comment 'team this URL pattern belongs to',
    `app_id` UUID comment 'app this URL pattern belongs to',
    `domain` String comment 'domain of the URL pattern, e.g. "example.com"',
    `path` String comment 'path of the URL pattern, e.g. "/users/*/profile"',
    `updated_by` DateTime comment 'timestamp when this pattern was updated',
    `updated_at` UUID comment 'uuid for the user who updated this pattern'
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (team_id, app_id, domain, path)
TTL updated_at + INTERVAL 30 DAY

-- migrate:down
DROP TABLE IF EXISTS url_patterns
