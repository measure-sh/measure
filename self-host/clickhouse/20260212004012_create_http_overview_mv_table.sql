-- migrate:up
CREATE MATERIALIZED VIEW measure.http_overview_mv TO measure.http_overview AS
SELECT
    team_id,
    app_id,
    origin,
    -- Path normalization: 2-pass regex to collapse high-cardinality segments into *
    -- Inline tokens (matched anywhere in the path):
    --   [0-9a-fA-F]{8}-...-[0-9a-fA-F]{12}  UUIDs
    --   [0-9a-fA-F]{40}                       SHA1 hashes (before MD5 to avoid partial match)
    --   [0-9a-fA-F]{32}                       MD5 hashes
    --   0[xX][0-9a-fA-F]+                     Hex literals (0x1A3F)
    --   [0-9]{4}-..T..:..:..]                 ISO 8601 timestamps
    -- Segment-level patterns (full segments between slashes):
    --   [0-9]+                                Purely numeric (/42/)
    --   [^/]*[0-9]{2,}[^/]*                   Contains 2+ consecutive digits (/item42name/)
    --   [^/]{60,}                             60+ chars, likely dynamic identifiers
    replaceRegexpAll(
        replaceRegexpAll(
            path,
            '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F]{40}|[0-9a-fA-F]{32}|0[xX][0-9a-fA-F]+|[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]',
            '*'
        ),
        '/([0-9]+|[^/]*[0-9]{2,}[^/]*|[^/]{60,})(/|$)',
        '/*\\2'
    ) AS path,
    toStartOfFifteenMinutes(bucket) AS bucket,
    count() AS count,
    countIf(
        status_code >= 400
        AND status_code < 600
    ) AS error_count,
    quantileState(0.95)(duration) AS duration_quantile
FROM
    measure.http
GROUP BY
    team_id,
    app_id,
    origin,
    path,
    bucket;

-- migrate:down
DROP VIEW IF EXISTS measure.http_overview_mv;