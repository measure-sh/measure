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
#               the failed day, keep the other settings
#               of the failed run
#   - RECREATE_RESOURCES=0
#   - REPLAY_EVENTS=0 when resuming spans
#   - INITIAL_EVENTS_DAY=YYYY-MM-DD
#   - INITIAL_SPANS_DAY=YYYY-MM-DD
# - Split:      Replay part of the data in each run, finalize
#               only the last run
#   - RECREATE_RESOURCES=1 for the first run, 0 for the rest
#   - REPLAY_EVENTS=1 or 0
#   - REPLAY_SPANS=1 or 0
#   - PARTITIONS="xxxxxx xxxxxx"
#   - FINALIZE=0 for every run but the last, 1 for the last
#
# A failed replay prints the settings to resume with.
# A run that stops without printing them, like a killed
# job, resumes with INITIAL_*_DAY set to the day after
# the last "Replayed" line. The in-flight day may be
# partly replayed, those rows dedup on merge.
#
# If re-creating resources fails, run the script again.
# If dropping resources fails, run it again with
# RECREATE_RESOURCES=0 REPLAY_EVENTS=0 REPLAY_SPANS=0.
#
# The cleanup service may keep running, day chunks
# don't shift when rows are deleted.

# Run against ClickHouse Cloud
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
# Day to resume events from, like 2026-09-15.
# Earlier days are skipped.
INITIAL_EVENTS_DAY="${INITIAL_EVENTS_DAY:-}"
# Day to resume spans from
INITIAL_SPANS_DAY="${INITIAL_SPANS_DAY:-}"
# Drop all resources after
# successful migration.
FINALIZE="${FINALIZE:-1}"
# Threads for each day insert
MAX_THREADS="${MAX_THREADS:-8}"

# List of partitions to migrate, like
# "202609 202610". Defaults to the active
# partitions of each table.
PARTITIONS_SET=0
if [[ -n "${PARTITIONS:-}" ]]; then
  PARTITIONS_SET=1
fi
PARTITIONS=${PARTITIONS:-""}
read -r -a PARTITIONS <<<"$PARTITIONS"

validate_day() {
  local name=$1
  local value=$2

  if [[ -z "$value" || "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    return 0
  fi
  echo "  ✗ $name must be YYYY-MM-DD, got: $value"
  exit 1
}

if [[ ! "$MAX_THREADS" =~ ^[1-9][0-9]*$ ]]; then
  echo "  ✗ MAX_THREADS must be a positive integer, got: $MAX_THREADS"
  exit 1
fi

validate_day INITIAL_EVENTS_DAY "$INITIAL_EVENTS_DAY"
validate_day INITIAL_SPANS_DAY "$INITIAL_SPANS_DAY"

echo "Migration Settings"
echo "=================="
echo "USE_CLOUD: $USE_CLOUD"
echo "RECREATE_RESOURCES: $RECREATE_RESOURCES"
echo "REPLAY_EVENTS: $REPLAY_EVENTS"
echo "REPLAY_SPANS: $REPLAY_SPANS"
echo "INITIAL_EVENTS_DAY: $INITIAL_EVENTS_DAY"
echo "INITIAL_SPANS_DAY: $INITIAL_SPANS_DAY"
echo "FINALIZE: $FINALIZE"
echo "MAX_THREADS: $MAX_THREADS"
echo "PARTITIONS: ${PARTITIONS[*]}"
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

# Must list every source column the MVs read, inserted_at included, else it defaults to now64()
# shellcheck disable=SC2016
EVENTS_COLUMNS='id, team_id, app_id, session_id, timestamp, inserted_at, type, `attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, `attribute.patch_version`, `attribute.patch_id`, `attribute.os_name`, `attribute.os_version`, `attribute.device_name`, `attribute.device_manufacturer`, `attribute.device_locale`, `attribute.network_type`, `attribute.network_generation`, `attribute.network_provider`, `attribute.user_id`, `inet.country_code`, user_defined_attribute, `lifecycle_activity.type`, `lifecycle_activity.class_name`, `lifecycle_fragment.type`, `lifecycle_fragment.class_name`, `lifecycle_view_controller.type`, `lifecycle_view_controller.class_name`, `lifecycle_swift_ui.type`, `lifecycle_swift_ui.class_name`, `screen_view.name`, `custom.name`, `anr.fingerprint`, `app_hang.fingerprint`, `app_hang.state`, `exception.fingerprint`, `exception.severity`, `exception.handled`, `http.method`, `http.url`, `http.status_code`, `http.start_time`, `http.end_time`, `gesture_click.target`, `gesture_click.target_id`, `gesture_click.label`, `gesture_click.semantic_label`, `gesture_long_click.target`, `gesture_long_click.target_id`, `gesture_long_click.label`, `gesture_long_click.semantic_label`, `gesture_scroll.target`, `gesture_scroll.target_id`, `gesture_scroll.direction`, `lifecycle_app.type`, `cold_launch.launched_activity`, `cold_launch.intent_data`, `cold_launch.duration`, `warm_launch.launched_activity`, `warm_launch.intent_data`, `warm_launch.duration`, `hot_launch.launched_activity`, `hot_launch.intent_data`, `hot_launch.duration`'
# shellcheck disable=SC2016
SPANS_COLUMNS='team_id, app_id, session_id, inserted_at, span_name, span_id, parent_id, trace_id, status, start_time, end_time, `attribute.installation_id`, `attribute.app_version`, `attribute.os_version`, `attribute.patch_version`, `attribute.patch_id`, `attribute.device_name`, `attribute.device_manufacturer`, `attribute.device_locale`, `attribute.network_type`, `attribute.network_generation`, `attribute.network_provider`, `attribute.user_id`, `attribute.country_code`, user_defined_attribute'

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
#   $@: The day setting of the failed day, like INITIAL_EVENTS_DAY=2026-09-15
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
  if [[ "$PARTITIONS_SET" -eq 1 ]]; then
    settings+=("PARTITIONS=\"${PARTITIONS[*]}\"")
  fi
  if [[ "$MAX_THREADS" -ne 8 ]]; then
    settings+=(MAX_THREADS="$MAX_THREADS")
  fi
  settings+=("$@")

  echo "  Resume with:"
  if [[ "$USE_CLOUD" -eq 1 ]]; then
    echo "  ${settings[*]}"
  else
    echo "  sudo ${settings[*]} $0"
  fi
}

# Sets RESOLVED_PARTS to PARTITIONS or the active partitions of a table
#
# Args:
#   $1: The table
resolve_partitions() {
  local table=$1

  RESOLVED_PARTS=()
  if [[ "$PARTITIONS_SET" -eq 1 ]]; then
    RESOLVED_PARTS=("${PARTITIONS[@]}")
    return 0
  fi

  local out
  out=$(clickhouse_query --query "select distinct partition from system.parts where database = currentDatabase() and table = '$table' and active order by partition")
  out=${out//$'\r'/}
  read -r -d '' -a RESOLVED_PARTS <<<"$out" || true
}

# Prints the first day to replay in a partition
#
# Args:
#   $1: The partition
#   $2: The initial day, may be empty
first_day() {
  local part=$1
  local initial_day=$2
  local first="${part:0:4}-${part:4:2}-01"

  if [[ -n "$initial_day" && "$initial_day" > "$first" ]]; then
    first=$initial_day
  fi
  echo "$first"
}

# Replays one partition day by day
#
# Args:
#   $1: The replay, events or spans
#   $2: The source table
#   $3: The time column
#   $4: The column list to insert
#   $5: The initial day, may be empty
#   $6: The resume setting name
#   $7: The partition
replay_partition() {
  local replay=$1
  local table=$2
  local time_column=$3
  local columns=$4
  local initial_day=$5
  local resume_name=$6
  local part=$7

  if [[ -n "$initial_day" && "$part" -lt "${initial_day:0:4}${initial_day:5:2}" ]]; then
    echo "  ✔ Skipping partition $part"
    return 0
  fi

  echo "  ✔ Starting partition $part"

  local days_out
  if ! days_out=$(clickhouse_query --query "select distinct toDate($time_column) from $table where toYYYYMM($time_column) = $part order by 1"); then
    echo "  ✗ Listing days failed in partition $part"
    print_resume "$replay" "$resume_name=$(first_day "$part" "$initial_day")"
    return 1
  fi

  days_out=${days_out//$'\r'/}
  local days=()
  read -r -d '' -a days <<<"$days_out" || true

  local day
  for day in "${days[@]}"; do
    if [[ -n "$initial_day" && "$day" < "$initial_day" ]]; then
      continue
    fi

    local start=$SECONDS
    if ! clickhouse_query --query "
      insert into ${table}_null ($columns)
      select $columns
      from $table
      where toYYYYMM($time_column) = $part and toDate($time_column) = '$day'
      settings max_threads = $MAX_THREADS
    "; then
      echo "  ✗ Insert failed for $day in partition $part"
      print_resume "$replay" "$resume_name=$day"
      return 1
    fi
    echo "  ✔ Replayed $replay for $day in $((SECONDS - start))s"
  done

  echo "  ✔ Finished partition $part"
}

# Replays all partitions of a table
#
# Args: same as replay_partition, without the partition
replay_table() {
  local replay=$1
  local table=$2

  echo "  ✔ Replaying $replay"

  resolve_partitions "$table"
  local parts=("${RESOLVED_PARTS[@]}")
  if [[ ${#parts[@]} -eq 0 ]]; then
    echo "  ✔ No partitions for $table, skipping"
    return 0
  fi
  echo "  ✔ Partitions: ${parts[*]}"

  local part
  for part in "${parts[@]}"; do
    replay_partition "$@" "$part" || return 1
  done

  echo "  ✔ Finished replaying all $replay partitions"
}

replay_events() {
  replay_table events events timestamp "$EVENTS_COLUMNS" "$INITIAL_EVENTS_DAY" INITIAL_EVENTS_DAY
}

replay_spans() {
  replay_table spans spans start_time "$SPANS_COLUMNS" "$INITIAL_SPANS_DAY" INITIAL_SPANS_DAY
}

drop_resources() {
  echo "  ✔ Drop null analytics events"
  clickhouse_query --query "drop table if exists analytics_events_null_mv sync"
  clickhouse_query --query "drop table if exists events_null sync"

  echo "  ✔ Drop null analytics spans"
  clickhouse_query --query "drop table if exists analytics_spans_null_mv sync"
  clickhouse_query --query "drop table if exists spans_null sync"
}

require_tables() {
  local table
  local exists
  for table in events spans analytics_events; do
    exists=$(clickhouse_query --query "exists table $table")
    exists=${exists//$'\r'/}
    if [[ "$exists" != 1 ]]; then
      echo "  ✗ table $table does not exist, run the schema migrations first"
      exit 1
    fi
  done
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

require_tables

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
