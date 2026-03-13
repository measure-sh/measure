-- migrate:up
alter table app_metrics_mv modify query
select
    team_id,
    app_id,
    toStartOfFifteenMinutes(timestamp)                                                                           as timestamp,
    (attribute.app_version, attribute.app_build)                                                                 as app_version,
    uniqState(session_id)                                                                                        as unique_sessions,
    uniqStateIf(session_id, (type = 'exception') and (exception.handled = 0))                                    as crash_sessions,
    uniqStateIf(session_id, (type = 'exception') and (exception.handled = 0) and (exception.foreground = 1))    as perceived_crash_sessions,
    uniqStateIf(session_id, type = 'anr')                                                                       as anr_sessions,
    uniqStateIf(session_id, (type = 'anr') and (anr.foreground = 1))                                            as perceived_anr_sessions,
    quantileStateIf(0.95)(cold_launch.duration, (type = 'cold_launch') and (cold_launch.duration > 0) and (cold_launch.duration <= 30000)) as cold_launch_p95,
    quantileStateIf(0.95)(warm_launch.duration, (type = 'warm_launch') and (warm_launch.duration > 0) and (warm_launch.duration <= 10000)) as warm_launch_p95,
    quantileStateIf(0.95)(hot_launch.duration, (type = 'hot_launch') and (hot_launch.duration > 0))             as hot_launch_p95
from events
group by
    team_id,
    app_id,
    timestamp,
    app_version;

-- migrate:down
alter table app_metrics_mv modify query
SELECT
    team_id,
    app_id,
    toStartOfFifteenMinutes(timestamp) AS timestamp,
    (toString(attribute.app_version), toString(attribute.app_build)) AS app_version,
    uniqState(session_id) AS unique_sessions,
    uniqStateIf(session_id, (type = 'exception') AND (exception.handled = false)) AS crash_sessions,
    uniqStateIf(session_id, (type = 'exception') AND (exception.handled = false) AND (exception.foreground = true)) AS perceived_crash_sessions,
    uniqStateIf(session_id, type = 'anr') AS anr_sessions,
    uniqStateIf(session_id, (type = 'anr') AND (anr.foreground = true)) AS perceived_anr_sessions,
    quantileStateIf(0.95)(cold_launch.duration, (type = 'cold_launch') AND (cold_launch.duration > 0) AND (cold_launch.duration <= 30000)) AS cold_launch_p95,
    quantileStateIf(0.95)(warm_launch.duration, (type = 'warm_launch') AND (warm_launch.duration > 0) AND (warm_launch.duration <= 10000)) AS warm_launch_p95,
    quantileStateIf(0.95)(hot_launch.duration, (type = 'hot_launch') AND (hot_launch.duration > 0)) AS hot_launch_p95
FROM events
GROUP BY
    team_id,
    app_id,
    timestamp,
    app_version
ORDER BY
    app_id ASC,
    timestamp ASC,
    app_version ASC;
