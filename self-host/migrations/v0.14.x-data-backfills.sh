#!/usr/bin/env bash

# exit on error
set -e

######################
# Migration Settings #
######################
# Use these settings to tune the migration
# according to your needs.
#
# There are various migration scenarios.
#
# - Complete:   Recreate resources, replay data, finalize
#   - RECREATE_RESOURCES=1
#   - REPLAY_EVENTS=1
#   - REPLAY_SPANS=1
#   - FINALIZE=1
# - Resume:     Don't recreate resources, replay data from
#               the failed chunk, keep the other settings
#               of the failed run
#   - RECREATE_RESOURCES=0
#   - REPLAY_EVENTS=0 when resuming spans
#   - INITIAL_EVENTS_PARTITION=xxxxxx (cloud mode)
#   - INITIAL_EVENTS_OFFSET=xxxxx
#   - INITIAL_SPANS_PARTITION=xxxxxx (cloud mode)
#   - INITIAL_SPANS_OFFSET=xxxxx
# - Split:      Replay part of the data in each run, finalize
#               only the last run
#   - RECREATE_RESOURCES=1 for the first run, 0 for the rest
#   - REPLAY_EVENTS=1 or 0
#   - REPLAY_SPANS=1 or 0
#   - PARTITIONS="xxxxxx xxxxxx" (cloud mode)
#   - FINALIZE=0 for every run but the last, 1 for the last
#
# A failed replay prints the settings to resume with.
# A run that stops without printing them, like a killed
# job, resumes from its last "Replaying chunk" line.
#
# If re-creating resources fails, run the script again.
# If dropping resources fails, run it again with
# RECREATE_RESOURCES=0 REPLAY_EVENTS=0 REPLAY_SPANS=0.
#
# Stop the cleanup service while the script runs.
# The cleanup deletes rows past retention, and
# deleting rows during a replay shifts the chunk
# offsets, so the replay could skip rows.

# Run in cloud mode
USE_CLOUD="${USE_CLOUD:-0}"
# Test connectivity only, no data will be read
# or written. Only tables will be listed.
#
# Exits early.
CONNECTIVITY="${CONNECTIVITY:-0}"
# Re-create null tables and materialized views
# and truncate analytics_events
RECREATE_RESOURCES="${RECREATE_RESOURCES:-1}"
# Replay all events data
REPLAY_EVENTS="${REPLAY_EVENTS:-1}"
# Replay all spans data
REPLAY_SPANS="${REPLAY_SPANS:-1}"
# Partition and offset to resume events from.
# Partitions before it are skipped, and the
# offset applies only to the first partition
# replayed. The partition is used in cloud
# mode only.
INITIAL_EVENTS_PARTITION="${INITIAL_EVENTS_PARTITION:-}"
INITIAL_EVENTS_OFFSET="${INITIAL_EVENTS_OFFSET:-0}"
# Partition and offset to resume spans from
INITIAL_SPANS_PARTITION="${INITIAL_SPANS_PARTITION:-}"
INITIAL_SPANS_OFFSET="${INITIAL_SPANS_OFFSET:-0}"
# Drop all resources after
# successful migration.
FINALIZE="${FINALIZE:-1}"

# Replay chunk size
CHUNK_SIZE=10000

if [[ "$USE_CLOUD" -eq 1 ]]; then
  CHUNK_SIZE=10000000
fi

# List of partitions to migrate, like
# "202609 202610". Used in cloud mode only.
PARTITIONS=${PARTITIONS:-""}
read -r -a PARTITIONS <<<"$PARTITIONS"

echo "Migration Settings"
echo "=================="
echo "USE_CLOUD: $USE_CLOUD"
echo "RECREATE_RESOURCES: $RECREATE_RESOURCES"
echo "REPLAY_EVENTS: $REPLAY_EVENTS"
echo "REPLAY_SPANS: $REPLAY_SPANS"
echo "INITIAL_EVENTS_PARTITION: $INITIAL_EVENTS_PARTITION"
echo "INITIAL_EVENTS_OFFSET: $INITIAL_EVENTS_OFFSET"
echo "INITIAL_SPANS_PARTITION: $INITIAL_SPANS_PARTITION"
echo "INITIAL_SPANS_OFFSET: $INITIAL_SPANS_OFFSET"
echo "FINALIZE: $FINALIZE"
echo "PARTITIONS: ${PARTITIONS[@]}"
echo
echo "CHUNK_SIZE: $CHUNK_SIZE"
echo

############################
# Core Migration Procedure #
############################
# Any modification beyond this point
# should be done with care.

analytics_events_mv() {
  local mv_name="$1"
  local source="$2"
  local dest="$3"

  cat <<EOF
create materialized view $mv_name
to $dest
as select
  id,
  team_id,
  app_id,
  attribute.installation_id as installation_id,
  session_id,
  timestamp,
  inserted_at,
  type,
  multiIf(
    type = 'lifecycle_activity', lifecycle_activity.class_name,
    type = 'lifecycle_fragment', lifecycle_fragment.class_name,
    type = 'lifecycle_view_controller', lifecycle_view_controller.class_name,
    type = 'lifecycle_swift_ui', lifecycle_swift_ui.class_name,
    type = 'screen_view', screen_view.name,
    '') as \`screen.name\`,
  if(type = 'custom', toString(custom.name), '') as \`custom.name\`,
  multiIf(
    type = 'anr', toString(anr.fingerprint),
    type = 'app_hang', app_hang.fingerprint,
    type = 'exception', toString(exception.fingerprint),
    '') as \`error.fingerprint\`,
  multiIf(
    type in ('anr', 'app_hang'), 'fatal',
    type = 'exception' and (exception.severity = 'fatal' or (exception.severity = '' and exception.handled = false)), 'fatal',
    type = 'exception', 'nonfatal',
    '') as \`error.severity\`,
  if(type = 'app_hang', app_hang.state, '') as \`app_hang.state\`,
  if(type = 'http', http.method, '') as \`http.method\`,
  if(type = 'http', domain(http.url), '') as \`http.domain\`,
  if(type = 'http', path(http.url), '') as \`http.path\`,
  if(type = 'http', http.status_code, 0) as \`http.status_code\`,
  if(type = 'http' and http.end_time >= http.start_time, toUInt32(least(http.end_time - http.start_time, 4294967295)), 0) as \`http.latency_ms\`,
  \`gesture_click.target\`,
  \`gesture_click.target_id\`,
  \`gesture_click.label\`,
  \`gesture_click.semantic_label\`,
  \`gesture_long_click.target\`,
  \`gesture_long_click.target_id\`,
  \`gesture_long_click.label\`,
  \`gesture_long_click.semantic_label\`,
  \`gesture_scroll.target\`,
  \`gesture_scroll.target_id\`,
  \`gesture_scroll.direction\`,
  \`lifecycle_app.type\`,
  \`cold_launch.launched_activity\`,
  \`cold_launch.intent_data\`,
  \`cold_launch.duration\`,
  \`warm_launch.launched_activity\`,
  \`warm_launch.intent_data\`,
  \`warm_launch.duration\`,
  \`hot_launch.launched_activity\`,
  \`hot_launch.intent_data\`,
  \`hot_launch.duration\`,
  attribute.app_version,
  attribute.app_build,
  attribute.patch_version,
  attribute.patch_id,
  attribute.os_name,
  attribute.os_version,
  attribute.device_name,
  attribute.device_manufacturer,
  attribute.device_locale,
  attribute.network_type,
  attribute.network_generation,
  attribute.network_provider,
  attribute.user_id,
  inet.country_code,
  user_defined_attribute
from $source
where (type = 'lifecycle_activity' and lifecycle_activity.type in ('created', 'resumed'))
      or (type = 'lifecycle_fragment' and lifecycle_fragment.type in ('attached', 'resumed'))
      or (type = 'lifecycle_view_controller' and lifecycle_view_controller.type in ('viewDidLoad', 'viewDidAppear'))
      or (type = 'lifecycle_swift_ui' and lifecycle_swift_ui.type = 'on_appear')
      or type = 'screen_view'
      or type = 'custom'
      or type = 'exception'
      or type = 'anr'
      or type = 'app_hang'
      or type = 'http'
      or type = 'gesture_click'
      or type = 'gesture_long_click'
      or type = 'gesture_scroll'
      or type = 'lifecycle_app'
      or type = 'cold_launch'
      or type = 'warm_launch'
      or type = 'hot_launch'
EOF
}

analytics_spans_mv() {
  local mv_name="$1"
  local source="$2"
  local dest="$3"

  cat <<EOF
create materialized view $mv_name
to $dest
as select
  -- A span has no event id. The id comes from the trace id and the span id.
  -- Thus the table removes a span that ingest inserts two times.
  reinterpretAsUUID(concat(
    reinterpretAsFixedString(cityHash64(trace_id, span_id)),
    reinterpretAsFixedString(cityHash64(span_id, trace_id)))) as id,
  team_id,
  app_id,
  attribute.installation_id as installation_id,
  session_id,
  start_time as timestamp,
  inserted_at,
  'span' as type,
  span_name as \`span.name\`,
  trace_id as \`span.trace_id\`,
  status as \`span.status\`,
  toUInt32(greatest(dateDiff('millisecond', start_time, end_time), 0)) as \`span.duration_ms\`,
  attribute.app_version.1 as \`attribute.app_version\`,
  attribute.app_version.2 as \`attribute.app_build\`,
  attribute.patch_version,
  attribute.patch_id,
  attribute.os_version.1 as \`attribute.os_name\`,
  attribute.os_version.2 as \`attribute.os_version\`,
  attribute.device_name,
  attribute.device_manufacturer,
  attribute.device_locale,
  attribute.network_type,
  attribute.network_generation,
  attribute.network_provider,
  attribute.user_id,
  attribute.country_code as \`inet.country_code\`,
  user_defined_attribute
from $source
where parent_id = ''
EOF
}

clickhouse_query() {
  local admin_user
  local admin_password
  local dbname

  dbname=measure

  if [[ "$USE_CLOUD" -eq 1 ]]; then
    local host="$CLICKHOUSE_HOST"
    admin_user="$CLICKHOUSE_ADMIN_USER"
    admin_password="$CLICKHOUSE_ADMIN_PASSWORD"

    clickhouse client \
      --user "$admin_user" \
      --password "$admin_password" \
      --database "$dbname" \
      --host "$host" \
      --port 9440 \
      --secure \
      --receive_timeout 3600 \
      --format TabSeparatedRaw \
      "$@"
  else
    admin_user=$(get_env_variable CLICKHOUSE_ADMIN_USER)
    admin_password=$(get_env_variable CLICKHOUSE_ADMIN_PASSWORD)

    clickhouse_client \
      --user "$admin_user" \
      --password "$admin_password" \
      --database "$dbname" \
      --receive_timeout 3600 \
      --format TabSeparatedRaw \
      "$@"
  fi
}

recreate_resources() {
  echo "  ✔ Create null analytics events"
  clickhouse_query --query "drop table if exists analytics_events_null_mv sync"
  clickhouse_query --query "drop table if exists events_null sync"
  clickhouse_query --query "create table events_null as events engine = Null"
  clickhouse_query --query "$(analytics_events_mv 'analytics_events_null_mv' 'events_null' 'analytics_events')"

  echo "  ✔ Create null analytics spans"
  clickhouse_query --query "drop table if exists analytics_spans_null_mv sync"
  clickhouse_query --query "drop table if exists spans_null sync"
  clickhouse_query --query "create table spans_null as spans engine = Null"
  clickhouse_query --query "$(analytics_spans_mv 'analytics_spans_null_mv' 'spans_null' 'analytics_events')"

  echo "  ✔ Truncate analytics events"
  clickhouse_query --query "truncate table if exists analytics_events"
}

# Prints the settings to resume a failed replay
#
# Args:
#   $1: The failed replay, events or spans
#   $@: The partition and offset of the failed chunk
print_resume() {
  local replay=$1
  shift

  local settings=(RECREATE_RESOURCES=0)
  if [[ "$replay" == spans ]]; then
    settings+=(REPLAY_EVENTS=0)
  elif [[ "$REPLAY_SPANS" -eq 0 ]]; then
    settings+=(REPLAY_SPANS=0)
  fi
  if [[ "$FINALIZE" -eq 0 ]]; then
    settings+=(FINALIZE=0)
  fi
  if [[ "$USE_CLOUD" -eq 1 ]]; then
    settings+=("PARTITIONS=\"${PARTITIONS[*]}\"")
  fi
  settings+=("$@")

  echo "  Resume with:"
  if [[ "$USE_CLOUD" -eq 1 ]]; then
    echo "  ${settings[*]}"
  else
    echo "  sudo ${settings[*]} $0"
  fi
}

replay_events() {
  echo "  ✔ Replaying events"

  if [[ "$USE_CLOUD" -eq 1 ]]; then
    local -i first_part=1
    for part in "${PARTITIONS[@]}"; do
      if [[ -n "$INITIAL_EVENTS_PARTITION" && "$part" -lt "$INITIAL_EVENTS_PARTITION" ]]; then
        echo "  ✔ Skipping partition $part"
        continue
      fi

      echo "  ✔ Starting partition $part"

      local -i offset=0
      if [[ "$first_part" -eq 1 ]]; then
        offset=$INITIAL_EVENTS_OFFSET
        first_part=0
      fi

      while true; do
        local chunk_count
        if ! chunk_count=$(clickhouse_query --query "
          select count()
          from (
            select 1
            from events
            where toYYYYMM(timestamp) = $part
            order by (team_id, app_id, attribute.app_version, attribute.app_build, timestamp, session_id, id)
            limit $CHUNK_SIZE offset $offset
          )
        "); then
          echo "  ✗ Count failed at offset $offset in partition $part"
          print_resume events INITIAL_EVENTS_PARTITION=$part INITIAL_EVENTS_OFFSET=$offset
          return 1
        fi

        # trim leading/trailing whitespace
        chunk_count=${chunk_count//$'\n'/}
        chunk_count=${chunk_count//$'\r'/}

        if [[ -z "$chunk_count" || "$chunk_count" -eq 0 ]]; then
          echo "  ✔ Finished partition $part"
          break
        fi

        echo "  ✔ Replaying chunk of $chunk_count events (offset $offset) in partition $part"

        if ! clickhouse_query --query "
          insert into events_null
          select
            *
          from events
          where toYYYYMM(timestamp) = $part
          order by (team_id, app_id, attribute.app_version, attribute.app_build, timestamp, session_id, id)
          limit $CHUNK_SIZE offset $offset
          settings
            min_insert_block_size_rows = 10484490,
            max_block_size = 1000000,
            max_threads = 16
        "; then
          echo "  ✗ Insert failed at offset $offset in partition $part"
          print_resume events INITIAL_EVENTS_PARTITION=$part INITIAL_EVENTS_OFFSET=$offset
          return 1
        fi

        ((offset += CHUNK_SIZE))
      done
    done

    echo "  ✔ Finished replaying all cloud partitions"
  else
    local -i offset=$INITIAL_EVENTS_OFFSET
    while true; do
      local chunk_count
      if ! chunk_count=$(clickhouse_query --query "
        select count()
        from (
          select 1
          from events
          order by (team_id, app_id, attribute.app_version, attribute.app_build, timestamp, session_id, id)
          limit $CHUNK_SIZE offset $offset
        )
      "); then
        echo "  ✗ Count failed at offset $offset"
        print_resume events INITIAL_EVENTS_OFFSET=$offset
        return 1
      fi

      # trim leading/trailing whitespace
      chunk_count=${chunk_count//$'\n'/}
      chunk_count=${chunk_count//$'\r'/}

      if [[ -z "$chunk_count" || "$chunk_count" -eq 0 ]]; then
        echo "  ✔ Finished replaying all events"
        break
      fi

      echo "  ✔ Replaying chunk of $chunk_count events (offset $offset)"

      if ! clickhouse_query --query "
        insert into events_null
        select
          *
        from events
        order by (team_id, app_id, attribute.app_version, attribute.app_build, timestamp, session_id, id)
        limit $CHUNK_SIZE offset $offset
      "; then
        echo "  ✗ Insert failed at offset $offset"
        print_resume events INITIAL_EVENTS_OFFSET=$offset
        return 1
      fi

      ((offset += CHUNK_SIZE))
    done
  fi
}

replay_spans() {
  echo "  ✔ Replaying spans"

  if [[ "$USE_CLOUD" -eq 1 ]]; then
    local -i first_part=1
    for part in "${PARTITIONS[@]}"; do
      if [[ -n "$INITIAL_SPANS_PARTITION" && "$part" -lt "$INITIAL_SPANS_PARTITION" ]]; then
        echo "  ✔ Skipping partition $part"
        continue
      fi

      echo "  ✔ Starting partition $part"

      local -i offset=0
      if [[ "$first_part" -eq 1 ]]; then
        offset=$INITIAL_SPANS_OFFSET
        first_part=0
      fi

      while true; do
        local chunk_count
        if ! chunk_count=$(clickhouse_query --query "
          select count()
          from (
            select 1
            from spans
            where toYYYYMM(start_time) = $part
            order by (team_id, app_id, attribute.app_version.1, attribute.app_version.2, span_name, start_time, trace_id, span_id)
            limit $CHUNK_SIZE offset $offset
          )
        "); then
          echo "  ✗ Count failed at offset $offset in partition $part"
          print_resume spans INITIAL_SPANS_PARTITION=$part INITIAL_SPANS_OFFSET=$offset
          return 1
        fi

        # trim leading/trailing whitespace
        chunk_count=${chunk_count//$'\n'/}
        chunk_count=${chunk_count//$'\r'/}

        if [[ -z "$chunk_count" || "$chunk_count" -eq 0 ]]; then
          echo "  ✔ Finished partition $part"
          break
        fi

        echo "  ✔ Replaying chunk of $chunk_count spans (offset $offset) in partition $part"

        if ! clickhouse_query --query "
          insert into spans_null
          select
            *
          from spans
          where toYYYYMM(start_time) = $part
          order by (team_id, app_id, attribute.app_version.1, attribute.app_version.2, span_name, start_time, trace_id, span_id)
          limit $CHUNK_SIZE offset $offset
          settings
            min_insert_block_size_rows = 10484490,
            max_block_size = 1000000,
            max_threads = 16
        "; then
          echo "  ✗ Insert failed at offset $offset in partition $part"
          print_resume spans INITIAL_SPANS_PARTITION=$part INITIAL_SPANS_OFFSET=$offset
          return 1
        fi

        ((offset += CHUNK_SIZE))
      done
    done

    echo "  ✔ Finished replaying all cloud partitions"
  else
    local -i offset=$INITIAL_SPANS_OFFSET
    while true; do
      local chunk_count
      if ! chunk_count=$(clickhouse_query --query "
        select count()
        from (
          select 1
          from spans
          order by (team_id, app_id, attribute.app_version.1, attribute.app_version.2, span_name, start_time, trace_id, span_id)
          limit $CHUNK_SIZE offset $offset
        )
      "); then
        echo "  ✗ Count failed at offset $offset"
        print_resume spans INITIAL_SPANS_OFFSET=$offset
        return 1
      fi

      # trim leading/trailing whitespace
      chunk_count=${chunk_count//$'\n'/}
      chunk_count=${chunk_count//$'\r'/}

      if [[ -z "$chunk_count" || "$chunk_count" -eq 0 ]]; then
        echo "  ✔ Finished replaying all spans"
        break
      fi

      echo "  ✔ Replaying chunk of $chunk_count spans (offset $offset)"

      if ! clickhouse_query --query "
        insert into spans_null
        select
          *
        from spans
        order by (team_id, app_id, attribute.app_version.1, attribute.app_version.2, span_name, start_time, trace_id, span_id)
        limit $CHUNK_SIZE offset $offset
      "; then
        echo "  ✗ Insert failed at offset $offset"
        print_resume spans INITIAL_SPANS_OFFSET=$offset
        return 1
      fi

      ((offset += CHUNK_SIZE))
    done
  fi
}

drop_resources() {
  echo "  ✔ Drop null analytics events"
  clickhouse_query --query "drop table if exists analytics_events_null_mv sync"
  clickhouse_query --query "drop table if exists events_null sync"

  echo "  ✔ Drop null analytics spans"
  clickhouse_query --query "drop table if exists analytics_spans_null_mv sync"
  clickhouse_query --query "drop table if exists spans_null sync"
}

# set up environment
if [[ "$USE_CLOUD" -eq 0 ]]; then
  SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/../shared.sh"

  check_base_dir
  set_docker_compose
fi

# kick things off
if [[ "$CONNECTIVITY" -eq 1 ]]; then
  echo "Testing connectivity..."
  clickhouse_query --query "show tables;"
  exit 0
fi

if [[ "$USE_CLOUD" -eq 1 ]]; then
  if [[ ${#PARTITIONS[@]} -eq 0 ]]; then
    echo "  ✗ PARTITIONS is empty, set the partitions to migrate in cloud mode"
    exit 1
  fi

  for initial_part in "$INITIAL_EVENTS_PARTITION" "$INITIAL_SPANS_PARTITION"; do
    if [[ -n "$initial_part" && " ${PARTITIONS[*]} " != *" $initial_part "* ]]; then
      echo "  ✗ partition $initial_part is not in PARTITIONS"
      exit 1
    fi
  done
fi

if [[ "$RECREATE_RESOURCES" -eq 1 ]]; then
  echo "Re-create resources..."
  recreate_resources
fi

if [[ "$REPLAY_EVENTS" -eq 1 ]]; then
  echo
  echo "Replay events..."
  replay_events
fi

if [[ "$REPLAY_SPANS" -eq 1 ]]; then
  echo
  echo "Replay spans..."
  replay_spans
fi

echo

if [[ "$FINALIZE" -eq 1 ]]; then
  echo "Drop resources..."
  drop_resources
fi
