-- migrate:up
create materialized view span_user_def_attrs_mv to span_user_def_attrs
(
    `team_id`     UUID,
    `app_id`      UUID,
    `span_id`     FixedString(16),
    `session_id`  UUID,
    `app_version` Tuple(LowCardinality(String), LowCardinality(String)),
    `os_version`  Tuple(LowCardinality(String), LowCardinality(String)),
    `key`         LowCardinality(String),
    `type`        Enum8('string' = 1, 'int64' = 2, 'float64' = 3, 'bool' = 4),
    `value`       String,
    `timestamp`   DateTime64(3, 'UTC')
)
as select distinct
    team_id,
    app_id,
    span_id,
    session_id,
    attribute.app_version as app_version,
    attribute.os_version  as os_version,
    arr_key               as key,
    arr_val.1             as type,
    arr_val.2             as value,
    start_time            as timestamp
from spans
array join
    mapKeys(user_defined_attribute)   as arr_key,
    mapValues(user_defined_attribute) as arr_val
where length(user_defined_attribute) > 0
group by
    team_id,
    app_id,
    app_version,
    os_version,
    key,
    type,
    value,
    span_id,
    session_id,
    timestamp;


-- migrate:down
drop view if exists span_user_def_attrs_mv;
