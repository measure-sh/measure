-- migrate:up
CREATE MATERIALIZED VIEW http_metrics_mv TO http_metrics AS
SELECT
    `team_id`,
    `app_id`,
    protocol(`http.url`) AS `protocol`,
    domain(`http.url`) AS `host`,
    toString(`http.method`) AS `method`,
    -- very high cardinality, should be converted to a normalzied format in the events ingestion
    path(`http.url`) AS `path`,
    toStartOfFiveMinutes(`timestamp`) AS `bucket`,
    `http.status_code` AS `status_code`,
    toString(`attribute.network_type`) AS `attribute.network_type`,
    toString(`attribute.network_generation`) AS `attribute.network_generation`,
    toString(`attribute.network_provider`) AS `attribute.network_provider`,
    toString(`attribute.app_version`) AS `attribute.app_version`,
    toString(`attribute.app_build`) AS `attribute.app_build`,
    count() AS `request_count`,
    quantilesState(0.50, 0.90, 0.95, 0.99)(
        toFloat32(`http.end_time` - `http.start_time`)
    ) AS `latency_quantile`
FROM
    events
GROUP BY
    `team_id`,
    `app_id`,
    `protocol`,
    `host`,
    `method`,
    `path`,
    `bucket`,
    `status_code`,
    `attribute.network_type`,
    `attribute.network_generation`,
    `attribute.network_provider`,
    `attribute.app_version`,
    `attribute.app_build`;

-- migrate:down
DROP VIEW IF EXISTS http_metrics_mv;