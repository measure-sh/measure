-- migrate:up
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

-- migrate:down
alter table app_metrics_mv modify query
SELECT
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
  app_id,
  timestamp,
  app_version
ORDER BY
  app_id ASC,
  timestamp ASC,
  app_version ASC;
