#!/usr/bin/env bash

# Migration
#
# This is a one off migration script that should be run as post DDL migration step.
# Assumes, the pre migration job has created the `events_rmt` and `spans_rmt`
# tables. This script performs backfilling of `events` and `spans` tables to
# populate all connected materialized views. Backfilling of `events` & `spans`
# are performed independently.
#
# Rollback
#
# In case things go south, run this script again as the operations are idempotent.

# exit on error
set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../shared.sh"

# Optimize entire clickhouse database for robust
# ingest deduplication.
#
# Migrate table engine of `events` and `spans` root tables
# to ReplacingMergeTree
#
# Note:
#   1. Both `events_rmt` & `spans_rmt` tables must exist
#   2. Column count & type of `events` & `events_rmt` tables must match
#   2. Column count & type of `spans` & `spans_rmt` tables must match
optimize_clickhouse_database() {
  local admin_user
  local admin_password
  local dbname
  local ch_version
  local exists

  admin_user=$(get_env_variable CLICKHOUSE_ADMIN_USER)
  admin_password=$(get_env_variable CLICKHOUSE_ADMIN_PASSWORD)
  dbname=measure

  if ! is_compose_service_up "clickhouse"; then
    start_clickhouse_service
  fi

  echo
  echo "Optimizing ClickHouse..."

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

  local events_cols_count
  events_cols_count=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --query "SELECT count() FROM system.columns WHERE database = '$dbname' and table = 'events';")

  local events_rmt_cols_count
  events_rmt_cols_count=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --query "SELECT count() FROM system.columns WHERE database = '$dbname' and table = 'events_rmt';")

  if ! [[ "$events_cols_count" == "$events_rmt_cols_count" ]]; then
    echo "Mismatch in column count between 'events' & 'events_rmt' tables."
    echo "events: $events_cols_count  events_rmt: $events_rmt_cols_count"
    return 1
  fi

  local spans_cols_count
  spans_cols_count=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --query "SELECT count() FROM system.columns WHERE database = '$dbname' and table = 'spans';")

  local spans_rmt_cols_count
  spans_rmt_cols_count=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --query "SELECT count() FROM system.columns WHERE database = '$dbname' and table = 'spans_rmt';")

  if ! [[ "$spans_cols_count" == "$spans_rmt_cols_count" ]]; then
    echo "Mismatch in column count between 'spans' & 'spans_rmt' tables."
    echo "spans: $events_cols_count  spans_rmt: $events_rmt_cols_count"
    return 1
  fi

  local events_rows_count
  events_rows_count=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --query "SELECT count() FROM events;")

  local spans_rows_count
  spans_rows_count=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --query "SELECT count() FROM spans;")

  # if both events and spans tables are empty, this must be a fresh
  # install.
  #
  # make 'events' & 'spans' ReplacingMergeTree tables & drop the
  # '*_rmt' tables.
  if [[ "$events_rows_count" == "0" && "$spans_rows_count" == "0" ]]; then
    $DOCKER_COMPOSE exec clickhouse clickhouse-client \
      --user "${admin_user}" \
      --password "${admin_password}" \
      --database "${dbname}" \
      --multiline \
      --query "
      exchange tables events_rmt and events;
      drop table if exists events_rmt;

      exchange tables spans_rmt and spans;
      drop table if exists spans_rmt;
      "

      echo "Optimization complete!"
      exit 0
  fi

  echo "This might take a while depending on volume of data."
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
    -- Prepare clean slate for migration
    drop table if exists events_to_new;
    truncate table if exists events_rmt;

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
      (select count() from events_rmt final) as events_rmt_count,
      (select count() from events) as events_count;

    -- Atomic exchange
    exchange tables events and events_rmt;

    -- Cleanup
    drop table if exists events_to_new sync;
    drop table if exists events_rmt sync;
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
      -- Prepare clean slate for migration
      drop table if exists spans_to_new;
      truncate table if exists spans_rmt;

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
        (select count() from spans_rmt final) as spans_rmt_count,
        (select count() from spans) as spans_count;

      -- Atomic exchange
      exchange tables spans and spans_rmt;

      -- Cleanup
      drop table if exists spans_to_new sync;
      drop table if exists spans_rmt sync;
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

  if ! is_compose_service_up "postgres"; then
    start_postgres_service
  fi

  if ! is_compose_service_up "clickhouse"; then
    start_clickhouse_service
  fi

  declare -A apps_teams

  local apps_output

  apps_output=$($DOCKER_COMPOSE exec -T -e PGPASSWORD="${pg_admin_password}" postgres psql -U "${pg_admin_user}" -d "${pg_dbname}" -A -F ',' -t -c "SELECT id, team_id FROM measure.apps;" 2>&1)

  while IFS=',' read -r id team_id; do
    # trim whitespace
    id="${id##+([[:space:]])}" id="${id%%+([[:space:]])}"
    team_id="${team_id##+([[:space:]])}" team_id="${team_id%%+([[:space:]])}"

    # skip empty lines
    [[ -z "$id" || -z "$team_id" ]] && continue

    apps_teams["$id"]="$team_id"
  done <<< "$apps_output"

  if [[ ${#apps_teams[@]} -eq 0 ]]; then
    echo "No apps found, skipping backfilling of team_id"
    return 0
  fi

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
  event_reqs_output=$($DOCKER_COMPOSE exec -T -e PGPASSWORD="${pg_admin_password}" postgres psql -U "${pg_admin_user}" -d "${pg_dbname}" -A -F ',' -t -c "SELECT id, app_id, to_char(created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as created_at FROM measure.event_reqs where status = 1;" 2>&1)

  local csv_str=""
  while IFS=',' read -r id app_id created_at; do
    # trim whitespace
    id="${id##+([[:space:]])}" id="${id%%+([[:space:]])}"
    app_id="${app_id##+([[:space:]])}" app_id="${app_id%%+([[:space:]])}"
    created_at="${created_at##+([[:space:]])}" created_at="${created_at%%+([[:space:]])}"

    # skip empty lines
    [[ -z "$id" || -z "$app_id" || -z "$created_at" ]] && continue

    local team_id="${apps_teams[$app_id]}"
    [[ -z "$team_id" ]] && continue

    csv_str+="${team_id},${app_id},${id},${created_at}\n"
  done <<< "$event_reqs_output"

  if [[ -z "$csv_str" ]]; then
    echo "Skipping backfilling of 'event_reqs', no matching app_id found"
    return 0
  fi

  local ingested_batches_output
  ingested_batches_output=$(echo -en "$csv_str" | $DOCKER_COMPOSE exec -T clickhouse clickhouse-client \
    --user "${ch_admin_user}" \
    --password "${ch_admin_password}" \
    --database "${ch_dbname}" \
    --query "insert into ingested_batches (team_id, app_id, batch_id, timestamp) settings async_insert=1, wait_for_async_insert=1 format CSV" 2>&1) || {
      echo "Failed to update 'ingested_batches' table: $ingested_batches_output"
      exit 1
    }

  echo "Backfill complete for 'ingested_batches' table"

  echo
  echo "Backfilling complete!"
  echo
}

# kick things off
check_base_dir
set_docker_compose
optimize_clickhouse_database
backfill_team_ids
