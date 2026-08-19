-- migrate:up
alter table app_metrics_mv modify query
select
    team_id,
    app_id,
    toStartOfFifteenMinutes(timestamp)                                                                           as timestamp,
    (attribute.app_version, attribute.app_build)                                                                 as app_version,
    uniqState(session_id)                                                                                        as unique_sessions,
    uniqStateIf(session_id, (type = 'exception') and (
        exception.severity = 'fatal' or (exception.severity = '' and exception.handled = 0)
    ))                                                                                       as crash_sessions,
    uniqStateIf(session_id, (type = 'exception') and (
        exception.severity = 'fatal' or (exception.severity = '' and exception.handled = 0)
    ) and (exception.foreground = 1))                                                        as perceived_crash_sessions,
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
