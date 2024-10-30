-- migrate:up
create materialized view app_metrics_mv to app_metrics as
select app_id,
       toStartOfFifteenMinutes(timestamp)                         as timestamp,
       tuple(toString(attribute.app_version),
             toString(attribute.app_build))                       as app_version,
       uniqState(session_id)                                 as unique_sessions,
       uniqStateIf(session_id, type = 'exception' and exception.handled =
                                                           false) as crash_sessions,
       uniqStateIf(session_id,
                        type = 'exception' and exception.handled = false and
                        exception.foreground =
                        true)                                     as perceived_crash_sessions,
       uniqStateIf(session_id, type = 'anr')                 as anr_sessions,
       uniqStateIf(session_id, type = 'anr' and anr.foreground =
                                                     true)        as perceived_anr_sessions,
       quantileStateIf(0.95)(cold_launch.duration,
                       type = 'cold_launch' and cold_launch.duration > 0 and
                       cold_launch.duration <=
                       30000)                                     as cold_launch_p95,
       quantileStateIf(0.95)(warm_launch.duration,
                       type = 'warm_launch' and warm_launch.duration > 0 and
                       warm_launch.duration <=
                       10000)                                     as warm_launch_p95,
       quantileStateIf(0.95)(hot_launch.duration,
                       type = 'hot_launch' and hot_launch.duration >
                                               0)                 as hot_launch_p95
from events
group by app_id, timestamp, app_version
order by app_id, timestamp, app_version;


-- migrate:down
drop view if exists app_metrics_mv;
