#!/usr/bin/env bash

# Migration
#
# This is a one off migration script that should be run as post migration.
# Assumes, the pre migration job has created the `events_rmt` and `spans_rmt`
# tables. This script performs backfilling of `events` and `spans` tables to
# populate all connected materialized views. Backfilling of `events` & `spans`
# are performed independently.
#
# Rollback
#
# In case things go south, activate the `rollback_events` & `rollback_spans`
# functions. These functions could also be run out of band to save time.

# exit on error
set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../shared.sh"

# Start the postgres service
start_postgres_service() {
  $DOCKER_COMPOSE \
    --file compose.yml \
    --file compose.prod.yml \
    up --wait -d postgres
}

# Start the clickhouse service
start_clickhouse_service() {
  $DOCKER_COMPOSE \
    --file compose.yml \
    --file compose.prod.yml \
    up --wait -d clickhouse
}

# Optimize entire clickhouse database for robust
# ingest deduplication.
#
# Migrate table engine of `events` and `spans` root tables
# to ReplacingMergeTree
optimize_clickhouse_database() {
  echo "Optimizing clickhouse database..."
  echo "This might take a while depending on volume of data."
  echo

  local admin_user
  local admin_password
  local dbname
  local ch_version
  local exists

  admin_user=$(get_env_variable CLICKHOUSE_ADMIN_USER)
  admin_password=$(get_env_variable CLICKHOUSE_ADMIN_PASSWORD)
  dbname=measure

  ch_version=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --format TSV \
    --query "SELECT version()")

  echo "ClickHouse server version: $ch_version"

  echo "Checking pre-requisites for optimization..."
  exists=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --query "exists table events_rmt;")

  if [[ $exists == "0" ]]; then
    echo "'events_rmt' table does not exists. please run DDL migrations first."
    return 1
  fi

  exists=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --query "exists table spans_rmt;")

  if [[ $exists == "0" ]]; then
    echo "'spans_rmt' table does not exists. please run DDL migrations first."
    return 1
  fi

  echo

  # backfill events
  echo "Backfilling events..."
  $DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --progress \
    --multiline \
    --hardware-utilization \
    --query "
    -- Forward all future writes to new table
    create materialized view events_to_new
    to events_rmt
    as select * from events;

    -- Backfill historical data
    insert into events_rmt
    select * from events;

    -- Monitor & verify
    select
      (select formatReadableSize(sum(bytes)) from system.parts where table = 'events_rmt' group by database) as events_size,
      (select count() from events_rmt) as events_rmt_count,
      (select count() from events) as events_count;

    -- Atomic switch
    rename table
      events to events_old,
      events_rmt to events;

    -- Cleanup
    drop table if exists events_old sync;
    drop table if exists events_to_new sync;
    "

    echo

    # backfill spans
    echo "Backfilling spans..."
    $DOCKER_COMPOSE exec clickhouse clickhouse-client \
      --user "${admin_user}" \
      --password "${admin_password}" \
      --database "${dbname}" \
      --progress \
      --multiline \
      --hardware-utilization \
      --query "
      -- Forward all future writes to new table
      create materialized view spans_to_new
      to spans_rmt
      as select * from spans;

      -- Backfill historical data
      insert into spans_rmt
      select * from spans;

      -- Monitor & verify
      select
        (select formatReadableSize(sum(bytes)) from system.parts where table = 'spans_rmt' group by database) as spans_size,
        (select count() from spans_rmt) as spans_rmt_count,
        (select count() from spans) as spans_count;

      -- Atomic switch
      rename table
        spans to spans_old,
        spans_rmt to spans;

      -- Cleanup
      drop table if exists spans_old sync;
      drop table if exists spans_to_new sync;
      "

    echo
    echo "Optimization complete!"
    echo
}

# Backfill non-existent or null team_id
# across ClickHouse database to each app's
# team_id.
backfill_team_ids() {
  echo "Backfilling team ids..."
  local pg_admin_user
  local pg_admin_password
  local pg_dbname

  local ch_admin_user
  local ch_admin_password
  local ch_dbname

  pg_admin_user=$(get_env_variable POSTGRES_USER)
  pg_admin_password=$(get_env_variable POSTGRES_PASSWORD)
  pg_dbname=measure

  ch_admin_user=$(get_env_variable CLICKHOUSE_ADMIN_USER)
  ch_admin_password=$(get_env_variable CLICKHOUSE_ADMIN_PASSWORD)
  ch_dbname=measure

  declare -A apps_teams

  local apps_output

  apps_output=$($DOCKER_COMPOSE exec -T -e PGPASSWORD="${pg_admin_password}" postgres psql -U "${pg_admin_user}" -d "${pg_dbname}" -A -F ',' -t -c "SELECT id, team_id FROM measure.apps;" 2>&1)

  while IFS=',' read -r id team_id; do
    # trim whitespace
    id="${id##+([[:space:]]}" id="${id%%+([[:space:]])}"
    team_id="${team_id##+([[:space:]])}" team_id="${team_id%%+([[:space:]]}"

    # skip empty lines
    [[ -z "$id" || -z "$team_id" ]] && continue

    apps_teams["$id"]="$team_id"
  done <<< "$apps_output"

  echo "Loaded ${#apps_teams[@]} entries in 'app_id --> team_id' dictionary"

  local zero_uuid="00000000-0000-0000-0000-000000000000"
  local update_str="update team_id = case"
  local in_str=""

  for id in "${!apps_teams[@]}"; do
    update_str+=" when app_id = toUUID('$id') then toUUID('${apps_teams[$id]}')"
    in_str+="${in_str:+, }toUUID('$id')"
  done

  update_str+=" else team_id end where team_id = toUUID('$zero_uuid') and app_id in ($in_str)"

  local ch_events_output
  if ! ch_events_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table events ${update_str};" 2>&1); then
    echo "Failed to update 'events' table: ${ch_events_output}"
    return 1
  fi

  echo "Backfill complete for 'events' table"

  local ch_spans_output
  if ! ch_spans_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table spans ${update_str};" 2>&1); then
    echo "Failed to update 'spans' table: ${ch_spans_output}"
    return 1
  fi

  echo "Backfill complete for 'spans' table"

  local ch_anr_groups_output
  if ! ch_anr_groups_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table anr_groups ${update_str};" 2>&1); then
    echo "Failed to update 'anr_groups' table: ${ch_anr_groups_output}"
    return 1
  fi

  echo "Backfill complete for 'anr_groups' table"

  local ch_unhandled_exception_groups_output
  if ! ch_unhandled_exception_groups_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table unhandled_exception_groups ${update_str};" 2>&1); then
    echo "Failed to update 'unhandled_exception_groups' table: ${ch_unhandled_exception_groups_output}"
    return 1
  fi

  echo "Backfill complete for 'unhandled_exception_groups' table"

  local ch_app_filters_output
  if ! ch_app_filters_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table app_filters ${update_str};" 2>&1); then
    echo "Failed to update 'app_filters' table: ${ch_app_filters_output}"
    return 1
  fi

  echo "Backfill complete for 'app_filters' table"

  local ch_app_metrics_output
  if ! ch_app_metrics_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table app_metrics ${update_str};" 2>&1); then
    echo "Failed to update 'app_metrics' table: ${ch_app_metrics_output}"
    return 1
  fi

  echo "Backfill complete for 'app_metrics' table"

  local ch_bug_reports_output
  if ! ch_bug_reports_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table bug_reports ${update_str};" 2>&1); then
    echo "Failed to update 'bug_reports' table: ${ch_bug_reports_output}"
    return 1
  fi

  echo "Backfill complete for 'bug_reports' table"

  local ch_sessions_output
  if ! ch_sessions_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table sessions ${update_str};" 2>&1); then
    echo "Failed to update 'sessions' table: ${ch_sessions_output}"
    return 1
  fi

  echo "Backfill complete for 'sessions' table"

  local ch_span_filters_output
  if ! ch_span_filters_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table span_filters ${update_str};" 2>&1); then
    echo "Failed to update 'span_filters' table: ${ch_span_filters_output}"
    return 1
  fi

  echo "Backfill complete for 'span_filters' table"

  local ch_span_metrics_output
  if ! ch_span_metrics_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table span_metrics ${update_str};" 2>&1); then
    echo "Failed to update 'span_metrics' table: ${ch_span_metrics_output}"
    return 1
  fi

  echo "Backfill complete for 'span_metrics' table"

  local ch_span_user_def_attrs_output
  if ! ch_span_user_def_attrs_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table span_user_def_attrs ${update_str};" 2>&1); then
    echo "Failed to update 'span_user_def_attrs' table: ${ch_span_user_def_attrs_output}"
    return 1
  fi

  echo "Backfill complete for 'span_user_def_attrs' table"

  local ch_user_def_attrs_output
  if ! ch_user_def_attrs_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "alter table user_def_attrs ${update_str};" 2>&1); then
    echo "Failed to update 'user_def_attrs' table: ${ch_user_def_attrs_output}"
    return 1
  fi

  echo "Backfill complete for 'user_def_attrs' table"

  local event_reqs_output
  event_reqs_output=$($DOCKER_COMPOSE exec -T -e PGPASSWORD="${pg_admin_password}" postgres psql -U "${pg_admin_user}" -d "${pg_dbname}" -A -F ',' -t -c "SELECT id, app_id, created_at FROM measure.event_reqs where status = 1;" 2>&1)

  local insert_str=""

  while IFS=',' read -r id app_id created_at; do
    # trim whitespace
    id="${id##+([[:space:]])}" id="${id%%+([[:space:]])}"
    app_id="${id##+([[:space:]])}" app_id="${id%%+([[:space:]])}"
    created_at="${created_at##+([[:space:]]}" created_at="${created_at%%+([[:space:]])}"

    # skip empty lines
    [[ -z "$id" || -z "$app_id" || -z "$created_at" ]] && continue

    local team_id="${apps_teams[$app_id]}"
    if ! [[ -z "$team_id" ]]; then
      insert_str+="${insert_str:+, }(toUUID('$team_id'), toUUID('$app_id'), toUUID('$id'), toDateTime('$created_at'))"
    fi

  done <<< "$event_reqs_output"

  if [[ -z "$insert_str" ]]; then
    echo "Skipping backfilling of 'event_reqs', no matching app_id found"
    return 0
  fi

  # insert old event reqs batches
  local ingested_batches_output
  if ! ingested_batches_output=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "insert into ingested_batches (team_id, app_id, batch_id, timestamp) values ${insert_str};" 2>&1); then
      echo "Failed to update 'ingested_batches' table: ${ingested_batches_output}"
      return 1
  fi

  echo
  echo "Backfilling complete!"
  echo
}

# rollback_events rolls back changes made to
# events table.
rollback_events() {
  local admin_user
  local admin_password
  local dbname

  admin_user=$(get_env_variable CLICKHOUSE_ADMIN_USER)
  admin_password=$(get_env_variable CLICKHOUSE_ADMIN_PASSWORD)
  dbname=measure

  $DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --query "rename table events to events_rmt, events_old to events;"

    echo
}

# rollback_spans rolls back changes made to
# spans table.
rollback_spans() {
  local admin_user
  local admin_password
  local dbname

  admin_user=$(get_env_variable CLICKHOUSE_ADMIN_USER)
  admin_password=$(get_env_variable CLICKHOUSE_ADMIN_PASSWORD)
  dbname=measure

  $DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --query "rename table spans to spans_rmt, spans_old to spans;"

    echo
}

# rollback rolls back changes made to
# root tables.
rollback() {
  echo "Rolling back changes..."
  rollback_events
  rollback_spans
}

# kick things off
check_base_dir
set_docker_compose
optimize_clickhouse_database
backfill_team_ids
# rollback
