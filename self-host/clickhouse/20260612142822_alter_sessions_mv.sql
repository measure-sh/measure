-- migrate:up
alter table sessions_mv
modify query
select
    session_id,
    team_id,
    app_id,
    minSimpleState(timestamp) as first_event_timestamp,
    maxSimpleState(timestamp) as last_event_timestamp,
    (attribute.app_version, attribute.app_build) as app_version,
    (attribute.os_name, attribute.os_version) as os_version,
    groupUniqArrayArraySimpleState(if(inet.country_code != '', [inet.country_code], [])) as country_codes,
    groupUniqArrayArraySimpleState(if(attribute.network_provider != '', [attribute.network_provider], [])) as network_providers,
    groupUniqArrayArraySimpleState(if(attribute.network_type != '', [attribute.network_type], [])) as network_types,
    groupUniqArrayArraySimpleState(if(attribute.network_generation != '', [attribute.network_generation], [])) as network_generations,
    groupUniqArrayArraySimpleState([attribute.device_locale]) as device_locales,
    argMax(attribute.device_name, timestamp) as device_name,
    argMax(attribute.device_manufacturer, timestamp) as device_manufacturer,
    argMax(attribute.device_model, timestamp) as device_model,
    groupUniqArrayArraySimpleState(if(attribute.user_id != '', [attribute.user_id], [])) as user_ids,
    groupUniqArrayArraySimpleState([type]) as unique_types,
    groupUniqArrayArraySimpleState(if(type = 'custom', [custom.name], [])) as unique_custom_type_names,
    groupUniqArrayArraySimpleState(if(`string.string` != '', [`string.string`], [])) as unique_strings,
    groupUniqArrayArraySimpleState(if(`log.body` != '', [`log.body`], [])) as unique_logs,
    groupUniqArrayArraySimpleState(if((type = 'lifecycle_activity') and (lifecycle_activity.class_name != ''), [lifecycle_activity.class_name], [])) as unique_view_classnames,
    groupUniqArrayArraySimpleState(if((type = 'lifecycle_fragment') and (lifecycle_fragment.class_name != ''), [lifecycle_fragment.class_name], [])) as unique_subview_classnames,
    -- fatal: severity='fatal' or (severity='' and handled=0)
    groupUniqArrayArraySimpleState(if(
        type = 'exception' and (
            exception.severity = 'fatal' or
            (exception.severity = '' and exception.handled = 0)
        ),
        [(simpleJSONExtractString(`exception.exceptions`, 'type'),
          simpleJSONExtractString(`exception.exceptions`, 'message'),
          simpleJSONExtractString(`exception.exceptions`, 'file_name'),
          simpleJSONExtractString(`exception.exceptions`, 'class_name'),
          simpleJSONExtractString(`exception.exceptions`, 'method_name'))],
        []
    )) as unique_fatal_exceptions,
    -- handled: severity='handled' or (severity='' and handled=1)
    groupUniqArrayArraySimpleState(if(
        type = 'exception' and (
            exception.severity = 'handled' or
            (exception.severity = '' and exception.handled = 1)
        ),
        [(simpleJSONExtractString(`exception.exceptions`, 'type'),
          simpleJSONExtractString(`exception.exceptions`, 'message'),
          simpleJSONExtractString(`exception.exceptions`, 'file_name'),
          simpleJSONExtractString(`exception.exceptions`, 'class_name'),
          simpleJSONExtractString(`exception.exceptions`, 'method_name'))],
        []
    )) as unique_handled_exceptions,
    -- nonfatal unhandled: strictly new, severity='unhandled' only
    groupUniqArrayArraySimpleState(if(
        type = 'exception' and exception.severity = 'unhandled',
        [(simpleJSONExtractString(`exception.exceptions`, 'type'),
          simpleJSONExtractString(`exception.exceptions`, 'message'),
          simpleJSONExtractString(`exception.exceptions`, 'file_name'),
          simpleJSONExtractString(`exception.exceptions`, 'class_name'),
          simpleJSONExtractString(`exception.exceptions`, 'method_name'))],
        []
    )) as unique_unhandled_exceptions,
    groupUniqArrayArraySimpleState(if(
        (type = 'exception') and (
            exception.num_code != 0 or
            (exception.code != '' and exception.code != '{}') or
            (exception.meta != '' and exception.meta != '{}')
        ),
        [concat(
            '{"num_code":', toString(exception.num_code),
            ',"code":', toJSONString(exception.code),
            ',"meta":', if(exception.meta = '' or exception.meta = '{}', '{}', exception.meta),
            '}'
        )],
        []
    )) as unique_errors,
    groupUniqArrayArraySimpleState(if(type = 'anr', [(simpleJSONExtractString(`anr.exceptions`, 'type'), simpleJSONExtractString(`anr.exceptions`, 'message'), simpleJSONExtractString(`anr.exceptions`, 'file_name'), simpleJSONExtractString(`anr.exceptions`, 'class_name'), simpleJSONExtractString(`anr.exceptions`, 'method_name'))], [])) as unique_anrs,
    groupUniqArrayArraySimpleState(if(type = 'gesture_click', [(gesture_click.target, gesture_click.target_id)], [])) as unique_click_targets,
    groupUniqArrayArraySimpleState(if(type = 'gesture_long_click', [(gesture_long_click.target, gesture_long_click.target_id)], [])) as unique_longclick_targets,
    groupUniqArrayArraySimpleState(if(type = 'gesture_scroll', [(gesture_scroll.target, gesture_scroll.target_id)], [])) as unique_scroll_targets,
    sumSimpleState(toUInt64(1)) as event_count,
    -- fatal count: legacy handled=0 or new severity='fatal'
    sumSimpleState(if(
        type = 'exception' and (
            exception.severity = 'fatal' or
            (exception.severity = '' and exception.handled = 0)
        ),
        toUInt64(1), toUInt64(0)
    )) as fatal_exception_count,
    -- handled count: legacy handled=1 or new severity='handled'
    sumSimpleState(if(
        type = 'exception' and (
            exception.severity = 'handled' or
            (exception.severity = '' and exception.handled = 1)
        ),
        toUInt64(1), toUInt64(0)
    )) as handled_exception_count,
    -- nonfatal unhandled count: strictly new
    sumSimpleState(if(
        type = 'exception' and exception.severity = 'unhandled',
        toUInt64(1), toUInt64(0)
    )) as unhandled_exception_count,
    sumSimpleState(if(type = 'anr', toUInt64(1), toUInt64(0))) as anr_count,
    sumSimpleState(if(type = 'bug_report', toUInt64(1), toUInt64(0))) as bug_report_count,
    sumSimpleState(if((type = 'lifecycle_app') and (lifecycle_app.type = 'background'), toUInt64(1), toUInt64(0))) as background_count,
    sumSimpleState(if((type = 'lifecycle_app') and (lifecycle_app.type = 'foreground'), toUInt64(1), toUInt64(0))) as foreground_count,
    sumMapSimpleState(map(type, toUInt64(1))) as event_type_counts
from events
group by
    team_id,
    app_id,
    session_id,
    app_version,
    os_version;

-- migrate:down
alter table sessions_mv
modify query
select
    session_id,
    team_id,
    app_id,
    minSimpleState(timestamp) as first_event_timestamp,
    maxSimpleState(timestamp) as last_event_timestamp,
    (attribute.app_version, attribute.app_build) as app_version,
    (attribute.os_name, attribute.os_version) as os_version,
    groupUniqArrayArraySimpleState(if(inet.country_code != '', [inet.country_code], [])) as country_codes,
    groupUniqArrayArraySimpleState(if(attribute.network_provider != '', [attribute.network_provider], [])) as network_providers,
    groupUniqArrayArraySimpleState(if(attribute.network_type != '', [attribute.network_type], [])) as network_types,
    groupUniqArrayArraySimpleState(if(attribute.network_generation != '', [attribute.network_generation], [])) as network_generations,
    groupUniqArrayArraySimpleState([attribute.device_locale]) as device_locales,
    argMax(attribute.device_name, timestamp) as device_name,
    argMax(attribute.device_manufacturer, timestamp) as device_manufacturer,
    argMax(attribute.device_model, timestamp) as device_model,
    groupUniqArrayArraySimpleState(if(attribute.user_id != '', [attribute.user_id], [])) as user_ids,
    groupUniqArrayArraySimpleState([type]) as unique_types,
    groupUniqArrayArraySimpleState(if(type = 'custom', [custom.name], [])) as unique_custom_type_names,
    groupUniqArrayArraySimpleState(if(`string.string` != '', [`string.string`], [])) as unique_strings,
    groupUniqArrayArraySimpleState(if((type = 'lifecycle_activity') and (lifecycle_activity.class_name != ''), [lifecycle_activity.class_name], [])) as unique_view_classnames,
    groupUniqArrayArraySimpleState(if((type = 'lifecycle_fragment') and (lifecycle_fragment.class_name != ''), [lifecycle_fragment.class_name], [])) as unique_subview_classnames,
    -- fatal: severity='fatal' or (severity='' and handled=0)
    groupUniqArrayArraySimpleState(if(
        type = 'exception' and (
            exception.severity = 'fatal' or
            (exception.severity = '' and exception.handled = 0)
        ),
        [(simpleJSONExtractString(`exception.exceptions`, 'type'),
          simpleJSONExtractString(`exception.exceptions`, 'message'),
          simpleJSONExtractString(`exception.exceptions`, 'file_name'),
          simpleJSONExtractString(`exception.exceptions`, 'class_name'),
          simpleJSONExtractString(`exception.exceptions`, 'method_name'))],
        []
    )) as unique_fatal_exceptions,
    -- handled: severity='handled' or (severity='' and handled=1)
    groupUniqArrayArraySimpleState(if(
        type = 'exception' and (
            exception.severity = 'handled' or
            (exception.severity = '' and exception.handled = 1)
        ),
        [(simpleJSONExtractString(`exception.exceptions`, 'type'),
          simpleJSONExtractString(`exception.exceptions`, 'message'),
          simpleJSONExtractString(`exception.exceptions`, 'file_name'),
          simpleJSONExtractString(`exception.exceptions`, 'class_name'),
          simpleJSONExtractString(`exception.exceptions`, 'method_name'))],
        []
    )) as unique_handled_exceptions,
    -- nonfatal unhandled: strictly new, severity='unhandled' only
    groupUniqArrayArraySimpleState(if(
        type = 'exception' and exception.severity = 'unhandled',
        [(simpleJSONExtractString(`exception.exceptions`, 'type'),
          simpleJSONExtractString(`exception.exceptions`, 'message'),
          simpleJSONExtractString(`exception.exceptions`, 'file_name'),
          simpleJSONExtractString(`exception.exceptions`, 'class_name'),
          simpleJSONExtractString(`exception.exceptions`, 'method_name'))],
        []
    )) as unique_unhandled_exceptions,
    groupUniqArrayArraySimpleState(if(
        (type = 'exception') and (
            exception.num_code != 0 or
            (exception.code != '' and exception.code != '{}') or
            (exception.meta != '' and exception.meta != '{}')
        ),
        [concat(
            '{"num_code":', toString(exception.num_code),
            ',"code":', toJSONString(exception.code),
            ',"meta":', if(exception.meta = '' or exception.meta = '{}', '{}', exception.meta),
            '}'
        )],
        []
    )) as unique_errors,
    groupUniqArrayArraySimpleState(if(type = 'anr', [(simpleJSONExtractString(`anr.exceptions`, 'type'), simpleJSONExtractString(`anr.exceptions`, 'message'), simpleJSONExtractString(`anr.exceptions`, 'file_name'), simpleJSONExtractString(`anr.exceptions`, 'class_name'), simpleJSONExtractString(`anr.exceptions`, 'method_name'))], [])) as unique_anrs,
    groupUniqArrayArraySimpleState(if(type = 'gesture_click', [(gesture_click.target, gesture_click.target_id)], [])) as unique_click_targets,
    groupUniqArrayArraySimpleState(if(type = 'gesture_long_click', [(gesture_long_click.target, gesture_long_click.target_id)], [])) as unique_longclick_targets,
    groupUniqArrayArraySimpleState(if(type = 'gesture_scroll', [(gesture_scroll.target, gesture_scroll.target_id)], [])) as unique_scroll_targets,
    sumSimpleState(toUInt64(1)) as event_count,
    -- fatal count: legacy handled=0 or new severity='fatal'
    sumSimpleState(if(
        type = 'exception' and (
            exception.severity = 'fatal' or
            (exception.severity = '' and exception.handled = 0)
        ),
        toUInt64(1), toUInt64(0)
    )) as fatal_exception_count,
    -- handled count: legacy handled=1 or new severity='handled'
    sumSimpleState(if(
        type = 'exception' and (
            exception.severity = 'handled' or
            (exception.severity = '' and exception.handled = 1)
        ),
        toUInt64(1), toUInt64(0)
    )) as handled_exception_count,
    -- nonfatal unhandled count: strictly new
    sumSimpleState(if(
        type = 'exception' and exception.severity = 'unhandled',
        toUInt64(1), toUInt64(0)
    )) as unhandled_exception_count,
    sumSimpleState(if(type = 'anr', toUInt64(1), toUInt64(0))) as anr_count,
    sumSimpleState(if(type = 'bug_report', toUInt64(1), toUInt64(0))) as bug_report_count,
    sumSimpleState(if((type = 'lifecycle_app') and (lifecycle_app.type = 'background'), toUInt64(1), toUInt64(0))) as background_count,
    sumSimpleState(if((type = 'lifecycle_app') and (lifecycle_app.type = 'foreground'), toUInt64(1), toUInt64(0))) as foreground_count,
    sumMapSimpleState(map(type, toUInt64(1))) as event_type_counts
from events
group by
    team_id,
    app_id,
    session_id,
    app_version,
    os_version;
