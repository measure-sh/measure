-- migrate:up
alter table user_def_attrs_mv modify query
select distinct
    e.team_id,
    e.app_id,
    e.id                                                     as event_id,
    e.session_id,
    (e.attribute.app_version, e.attribute.app_build)         as app_version,
    (e.attribute.os_name, e.attribute.os_version)            as os_version,
    if(e.type = 'bug_report', true, false)                   as bug_report,
    arr_key                                                  as key,
    arr_val.1                                                as type,
    arr_val.2                                                as value,
    e.timestamp                                              as timestamp
from events as e
array join
    mapKeys(e.user_defined_attribute)   as arr_key,
    mapValues(e.user_defined_attribute) as arr_val
where length(e.user_defined_attribute) > 0
group by
    team_id,
    app_id,
    app_version,
    os_version,
    e.type,
    key,
    type,
    value,
    event_id,
    session_id,
    timestamp;

-- migrate:down
alter table user_def_attrs_mv modify query
SELECT DISTINCT
    team_id,
    app_id,
    id AS event_id,
    session_id,
    toLastDayOfMonth(timestamp) AS end_of_month,
    (toString(attribute.app_version), toString(attribute.app_build)) AS app_version,
    (toString(attribute.os_name), toString(attribute.os_version)) AS os_version,
    if((events.type = 'exception') AND (exception.handled = false), true, false) AS exception,
    if(events.type = 'anr', true, false) AS anr,
    arr_key AS key,
    arr_val.1 AS type,
    arr_val.2 AS value,
    timestamp AS ver
FROM events
ARRAY JOIN
    mapKeys(user_defined_attribute) AS arr_key,
    mapValues(user_defined_attribute) AS arr_val
WHERE length(user_defined_attribute) > 0
GROUP BY
    team_id,
    app_id,
    end_of_month,
    app_version,
    os_version,
    events.type,
    exception.handled,
    key,
    type,
    value,
    event_id,
    session_id,
    ver
ORDER BY app_id ASC;
