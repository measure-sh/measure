#!/usr/bin/env bash

set -euo pipefail

echo "Starting to backfill data for Materialized View tables"
echo

# remove old resources
docker compose exec clickhouse clickhouse-client -q "
drop table if exists events_null;
drop view if exists app_filters_mv_null;
drop view if exists app_metrics_mv_null;
drop view if exists sessions_mv_null;
"

# create a null table engine
docker compose exec clickhouse clickhouse-client --progress -q "create table events_null as events engine = Null;"

# create a null materialized view for 'app_filters' table
echo "Creating materialized view for 'app_filters'"
docker compose exec clickhouse clickhouse-client --progress -q "
create materialized view app_filters_mv_null to app_filters as
select distinct app_id,
                toLastDayOfMonth(timestamp)             as end_of_month,
                (toString(attribute.app_version),
                 toString(attribute.app_build))         as app_version,
                (toString(attribute.os_name),
                 toString(attribute.os_version))        as os_version,
                toString(inet.country_code)             as country_code,
                toString(attribute.network_provider)    as network_provider,
                toString(attribute.network_type)        as network_type,
                toString(attribute.network_generation)  as network_generation,
                toString(attribute.device_locale)       as device_locale,
                toString(attribute.device_manufacturer) as device_manufacturer,
                toString(attribute.device_name)         as device_name,
                if(\`type\` = 'exception' and \`exception.handled\` = false, true,
                   false)                               as exception,
                if(type = 'anr', true, false)           as anr
from events_null
where toString(attribute.os_name) != ''
  and toString(attribute.os_version) != ''
  and toString(inet.country_code) != ''
  and toString(attribute.network_provider) != ''
  and toString(attribute.network_type) != ''
  and toString(attribute.network_generation) != ''
  and toString(attribute.device_locale) != ''
  and toString(attribute.device_manufacturer) != ''
  and toString(attribute.device_name) != ''
group by app_id, end_of_month, attribute.app_version, attribute.app_build, attribute.os_name,
         attribute.os_version, inet.country_code, attribute.network_provider,
         attribute.network_type,
         attribute.network_generation, attribute.device_locale,
         attribute.device_manufacturer, attribute.device_name,
         type, exception.handled
order by app_id;
"

# create a null materialized view for 'app_metrics' table
echo "Creating materialized view for 'app_metrics'"
docker compose exec clickhouse clickhouse-client --progress -q "
create materialized view app_metrics_mv_null to app_metrics as
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
from events_null
group by app_id, timestamp, app_version
order by app_id, timestamp, app_version;
"

# create a null materialized view for 'sessions' table
echo "Creating materialized view for 'sessions'"
docker compose exec clickhouse clickhouse-client --progress -q "
create materialized view sessions_mv_null to sessions as
select distinct session_id,
                app_id,
                min(timestamp)                                                 as first_event_timestamp,
                max(timestamp)                                                 as last_event_timestamp,
                any((toString(attribute.app_version),
                     toString(attribute.app_build)))                           as app_version,
                any((toString(attribute.os_name),
                     toString(attribute.os_version)))                          as os_version,
                any(toString(inet.country_code))                               as country_code,
                any(toString(attribute.network_provider))                      as network_provider,
                any(toString(attribute.network_type))                          as network_type,
                any(toString(attribute.network_generation))                    as network_generation,
                any(toString(attribute.device_locale))                         as device_locale,
                any(toString(attribute.device_manufacturer))                   as device_manufacturer,
                any(toString(attribute.device_name))                           as device_name,
                any(toString(attribute.device_model))                          as device_model,
                any(toString(attribute.user_id))                               as user_id,
                groupUniqArrayArraySimpleState(10)(
                                               array(toString(type)))          as unique_types,
                groupUniqArrayArraySimpleState(10)(
                                               array(toString(string.string))) as unique_strings,
                groupUniqArrayArraySimpleStateIf(10)(
                                                 array(toString(lifecycle_activity.class_name)),
                                                 type = 'lifecycle_activity' and
                                                 lifecycle_activity.class_name !=
                                                 '')                           as unique_view_classnames,
                groupUniqArrayArraySimpleStateIf(10)(
                                                 array(toString(lifecycle_fragment.class_name)),
                                                 type = 'lifecycle_fragment' and
                                                 lifecycle_fragment.class_name !=
                                                 '')                           as unique_subview_classnames,
                groupUniqArrayArraySimpleStateIf(5)(
                                                 array((simpleJSONExtractString(
                                                                exception.exceptions,
                                                                'type'),
                                                        simpleJSONExtractString(
                                                                exception.exceptions,
                                                                'message'),
                                                        simpleJSONExtractString(
                                                                exception.exceptions,
                                                                'file_name'),
                                                        simpleJSONExtractString(
                                                                exception.exceptions,
                                                                'class_name'),
                                                        simpleJSONExtractString(
                                                                exception.exceptions,
                                                                'method_name')
                                                     )),
                                                 type = 'exception' and
                                                 exception.handled =
                                                 false)                        as unique_exceptions,
                groupUniqArrayArraySimpleStateIf(5)(
                                                 array((simpleJSONExtractString(
                                                                anr.exceptions,
                                                                'type'),
                                                        simpleJSONExtractString(
                                                                anr.exceptions,
                                                                'message'),
                                                        simpleJSONExtractString(
                                                                anr.exceptions,
                                                                'file_name'),
                                                        simpleJSONExtractString(
                                                                anr.exceptions,
                                                                'class_name'),
                                                        simpleJSONExtractString(
                                                                anr.exceptions,
                                                                'method_name')
                                                     )),
                                                 type =
                                                 'anr')                        as unique_anrs,
                groupUniqArrayArraySimpleStateIf(5)(
                                                 array((toString(gesture_click.target),
                                                        toString(gesture_click.target_id))),
                                                 type =
                                                 'gesture_click')              as unique_click_targets,
                groupUniqArrayArraySimpleStateIf(5)(
                                                 array((
                                                        toString(gesture_long_click.target),
                                                        toString(gesture_long_click.target_id))),
                                                 type =
                                                 'gesture_long_click')         as unique_longclick_targets,
                groupUniqArrayArraySimpleStateIf(5)(
                                                 array((toString(gesture_scroll.target),
                                                        toString(gesture_scroll.target_id))),
                                                 type =
                                                 'gesture_scroll')             as unique_scroll_targets,

                uniqState(id)                                                  as event_count,
                uniqStateIf(id, type = 'exception' and exception.handled =
                                                       false)                  as crash_count,
                uniqStateIf(id, type = 'anr')                                  as anr_count
from events_null
group by app_id, session_id
order by app_id, session_id, first_event_timestamp, app_version, os_version;
"

# truncate tables just in case
# makes this script idempotent
docker compose exec clickhouse clickhouse-client --progress -q "
truncate table if exists app_filters;
truncate table if exists app_metrics;
truncate table if exists sessions;
"

# kickstart the backfill
echo
echo "Backfilling 'app_filters', 'app_metrics' & 'sessions' table"
docker compose exec clickhouse clickhouse-client --progress -q "insert into events_null select * from events;"

echo "Completed. All 3 tables populated."

# clean up used resources
echo "Cleaning up resources"
docker compose exec clickhouse clickhouse-client -q "
drop view app_filters_mv_null;
drop view app_metrics_mv_null;
drop view sessions_mv_null;
drop table events_null;
"