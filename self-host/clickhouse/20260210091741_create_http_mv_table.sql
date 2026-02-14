-- migrate:up
CREATE MATERIALIZED VIEW http_mv TO http AS
SELECT
    `team_id`,
    `app_id`,
    concat(protocol(`http.url`), '://', domain(`http.url`)) AS `origin`,
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
            path(`http.url`),
            '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F]{40}|[0-9a-fA-F]{32}|0[xX][0-9a-fA-F]+|[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]',
            '*'
        ),
        '/([0-9]+|[^/]*[0-9]{2,}[^/]*|[^/]{60,})(/|$)',
        '/*\\2'
    ) AS `path`,
    `http.status_code` AS `status_code`,
    `http.method` AS `method`,
    toStartOfFifteenMinutes(`timestamp`) AS `bucket`,
    
    -- Aggregated metrics
    countState() AS `request_count`,
    quantilesState(0.5, 0.9, 0.95, 0.99)(`http.end_time` - `http.start_time`) AS `duration_quantiles`,
    
    -- Sample attributes (same pattern as sessions)
    anyLast((toString(`attribute.app_version`), toString(`attribute.app_build`))) AS `app_version`,
    anyLast((toString(`attribute.os_name`), toString(`attribute.os_version`))) AS `os_version`,
    anyLast(toString(`attribute.network_provider`)) AS `network_provider`,
    anyLast(toString(`attribute.network_type`)) AS `network_type`,
    anyLast(toString(`attribute.network_generation`)) AS `network_generation`,
    anyLast(toString(`attribute.device_locale`)) AS `device_locale`,
    anyLast(toString(`attribute.device_manufacturer`)) AS `device_manufacturer`,
    anyLast(toString(`attribute.device_name`)) AS `device_name`,
    anyLast(toString(`attribute.device_model`)) AS `device_model`
FROM
    events
WHERE
    type = 'http'
GROUP BY
    `team_id`, `app_id`, `origin`, `path`, `status_code`, `method`, `bucket`;

-- migrate:down
DROP VIEW IF EXISTS http_mv;