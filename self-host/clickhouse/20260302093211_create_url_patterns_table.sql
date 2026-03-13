-- migrate:up
CREATE TABLE url_patterns
(
    `team_id` UUID comment 'team this URL pattern belongs to',
    `app_id` UUID comment 'app this URL pattern belongs to',
    `domain` String comment 'domain of the URL pattern, e.g. "example.com"',
    `path` String comment 'path of the URL pattern, e.g. "/users/*/profile"',
    `updated_at` DateTime comment 'timestamp when this pattern was updated',
    `updated_by` UUID comment 'uuid for the user who updated this pattern',
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (team_id, app_id, domain, path)
COMMENT 'URL path patterns for grouping http events'

-- migrate:down
DROP TABLE IF EXISTS url_patterns
