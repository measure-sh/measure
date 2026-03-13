-- migrate:up
create table if not exists url_patterns
(
    `team_id` LowCardinality(UUID) comment 'team this URL pattern belongs to' CODEC(LZ4),
    `app_id` LowCardinality(UUID) comment 'app this URL pattern belongs to' CODEC(LZ4),
    `domain` String comment 'domain of the URL pattern, e.g. "example.com"' CODEC(ZSTD(3)),
    `path` String comment 'path of the URL pattern, e.g. "/users/*/profile"' CODEC(ZSTD(3)),
    `updated_at`  DateTime64(3, 'UTC') comment 'timestamp when this pattern was updated' CODEC(DoubleDelta, ZSTD(3)),
    `updated_by` LowCardinality(UUID) comment 'uuid for the user who updated this pattern' CODEC(LZ4),
)
engine = ReplacingMergeTree(updated_at)
order by (team_id, app_id, domain, path)
comment 'URL path patterns for grouping http events'

-- migrate:down
drop table if exists url_patterns
