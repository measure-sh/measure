-- migrate:up
create materialized view if not exists sessions_span_index_mv to sessions_index
(
    `team_id`               LowCardinality(UUID),
    `app_id`                LowCardinality(UUID),
    `app_version`           Tuple(LowCardinality(String), LowCardinality(String)),
    `session_id`            UUID,
    `first_event_timestamp` DateTime64(3, 'UTC'),
    `last_event_timestamp`  DateTime64(3, 'UTC')
)
as select
    team_id,
    app_id,
    attribute.app_version    as app_version,
    session_id,
    min(start_time)          as first_event_timestamp,
    max(end_time)            as last_event_timestamp
from spans
group by
    team_id,
    app_id,
    app_version,
    session_id;


-- migrate:down
drop view if exists sessions_span_index_mv;
