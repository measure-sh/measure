-- migrate:up
create materialized view sessions_mv to sessions as
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
from events
group by app_id, session_id
order by app_id, session_id, first_event_timestamp, app_version, os_version;

-- migrate:down
drop view if exists sessions_mv;

