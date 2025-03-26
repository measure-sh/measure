#!/usr/bin/env bash

set -euo pipefail

has_command() {
  if command -v "$1" &>/dev/null; then
    return 0
  else
    return 1
  fi
}

if has_command docker-compose; then
  DOCKER_COMPOSE="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
else
  echo "Neither 'docker compose' nor 'docker-compose' is available" >&2
  exit 1
fi

echo "Starting to backfill data for Materialized View tables"
echo

# remove old resources
$DOCKER_COMPOSE exec clickhouse clickhouse-client -q "
drop table if exists events_null;
drop view if exists user_def_attrs_mv_null;
"

# create a null table for 'events'
echo "Creating null table for 'events'"
$DOCKER_COMPOSE exec clickhouse clickhouse-client --progress -q "create table events_null as events engine = NULL;"

# create a null materialized view for 'user_def_attrs' table
echo "Creating null materialized view for 'user_def_attrs'"
$DOCKER_COMPOSE exec clickhouse clickhouse-client --progress -q "
create materialized view user_def_attrs_mv_null to user_def_attrs as
select distinct app_id,
                id                                   as event_id,
                session_id,
                toLastDayOfMonth(timestamp)          as end_of_month,
                (toString(attribute.app_version),
                 toString(attribute.app_build))      as app_version,
                (toString(attribute.os_name),
                 toString(attribute.os_version))     as os_version,
                if(events.type = 'exception' and exception.handled = false,
                   true, false)                      as exception,
                if(events.type = 'anr', true, false) as anr,
                arr_key                              as key,
                tupleElement(arr_val, 1)             as type,
                tupleElement(arr_val, 2)             as value,
                timestamp                            as ver
from events_null
    array join
     mapKeys(user_defined_attribute) as arr_key,
     mapValues(user_defined_attribute) as arr_val
where length(user_defined_attribute) > 0
group by app_id, end_of_month, app_version, os_version, events.type,
         exception.handled, key, type, value, event_id, session_id,
         ver
order by app_id;
"

# truncate tables just in case
# makes this script idempotent
$DOCKER_COMPOSE exec clickhouse clickhouse-client --progress -q "
truncate table if exists user_def_attrs;
"

# kickstart the backfill
echo
echo "Backfilling 'user_def_attrs' table"
$DOCKER_COMPOSE exec clickhouse clickhouse-client --progress -q "insert into events_null select * from events;"

echo "Completed. Populated 'user_def_attrs' table."

# clean up used resources
echo "Cleaning up resources"
$DOCKER_COMPOSE exec clickhouse clickhouse-client -q "
drop view user_def_attrs_mv_null;
drop view events_null;
"
