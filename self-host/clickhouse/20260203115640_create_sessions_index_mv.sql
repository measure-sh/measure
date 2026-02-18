-- migrate:up
create materialized view if not exists sessions_index_mv
to sessions_index
as select
  team_id,
  app_id,
  (attribute.app_version, attribute.app_build) as app_version,
  session_id,
  min(timestamp) as first_event_timestamp,
  max(timestamp) as last_event_timestamp
from events
group by
  team_id,
  app_id,
  app_version,
  session_id;


-- migrate:down
drop table if exists sessions_index_mv;
