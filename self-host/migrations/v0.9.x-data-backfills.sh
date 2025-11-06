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

# Start the clickhouse service
start_clickhouse_service() {
  $DOCKER_COMPOSE \
    --file compose.yml \
    --file compose.prod.yml \
    up --wait -d clickhouse
}

optimize_clickhouse_database() {
  echo "Optimizing clickhouse database..."
  echo "This might take a while depending on volume of data."

  local admin_user
  local admin_password
  local dbname
  local ch_version

  admin_user=$(get_env_variable CLICKHOUSE_ADMIN_USER)
  admin_password=$(get_env_variable CLICKHOUSE_ADMIN_PASSWORD)
  dbname=measure

  ch_version=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "${admin_user}" \
    --password "${admin_password}" \
    --database "${dbname}" \
    --format TSV \
    --query "SELECT version()")

  echo "ClickHouse version: $ch_version"

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
}

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
    --query "rename table spans to span_rmt, spans_old to spans;"

    echo
}

rollback() {
  echo "Rolling back changes..."
  rollback_events
  rollback_spans
}


# kick things off
check_base_dir
set_docker_compose
optimize_clickhouse_database
# rollback
