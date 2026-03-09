-- migrate:up
create materialized view user_def_attrs_mv to user_def_attrs
(
    `team_id`     UUID,
    `app_id`      UUID,
    `event_id`    UUID,
    `session_id`  UUID,
    `app_version` Tuple(LowCardinality(String), LowCardinality(String)),
    `os_version`  Tuple(LowCardinality(String), LowCardinality(String)),
    `bug_report`  Bool,
    `key`         LowCardinality(String),
    `type`        Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4),
    `value`       String,
    `timestamp`   DateTime64(3, 'UTC')
)
as select distinct
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
drop view if exists user_def_attrs_mv;
