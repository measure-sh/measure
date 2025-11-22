#!/usr/bin/env bash

# exit on error
set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../shared.sh"

# Check if command is available
has_command() {
  if command -v "$1" &>/dev/null; then
    return 0
  else
    return 1
  fi
}

# Check if the script is run from the 'self-host' directory
check_base_dir() {
  local base_dir
  base_dir=$(basename "$(pwd)")
  if [[ "$base_dir" != "self-host" ]]; then
    echo "Error: This script must be run from the 'self-host' directory."
    exit 1
  fi
}

# Set the docker-compose command
set_docker_compose() {
  if has_command docker-compose; then
    DOCKER_COMPOSE="docker-compose"
  elif docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
  else
    echo "Neither 'docker compose' nor 'docker-compose' is available" >&2
    exit 1
  fi
}

# Start the postgres service
start_postgres_service() {
  $DOCKER_COMPOSE \
    --file compose.yml \
    --file compose.prod.yml \
    up --wait -d postgres
}

# Shutdown the postgres service
shutdown_postgres_service() {
  $DOCKER_COMPOSE \
    --file compose.yml \
    --file compose.prod.yml \
    down postgres
}

# Add default targeting rules data
add_default_targeting_rules() {
  echo "Adding default targeting rules..."
  start_postgres_service

  if ! $DOCKER_COMPOSE exec -T postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d measure <<-'EOF'
  do $$
  declare
    migration_user_id uuid;
    event_rules_count int;
    session_rules_count int;
    trace_rules_count int;
  begin
    -- Use nil UUID for migration user
    migration_user_id := '00000000-0000-0000-0000-000000000000'::uuid;

    -- Check if rules already exist
    select count(*) into event_rules_count from measure.event_targeting_rules;
    select count(*) into session_rules_count from measure.session_targeting_rules;
    select count(*) into trace_rules_count from measure.trace_targeting_rules;

    -- Insert default event targeting rules only if table is empty
    if event_rules_count = 0 then
      insert into measure.event_targeting_rules (
          id,
          team_id,
          app_id,
          name,
          condition,
          collection_mode,
          take_screenshot,
          take_layout_snapshot,
          sampling_rate,
          is_default_behaviour,
          created_at,
          created_by
      )
      select
          gen_random_uuid(),
          a.team_id,
          a.id,
          rules.name,
          rules.condition,
          rules.collection_mode,
          rules.take_screenshot,
          rules.take_layout_snapshot,
          rules.sampling_rate,
          rules.is_default_behaviour,
          now(),
          migration_user_id
      from measure.apps a
      cross join (
          values
              ('Collect all Events', 'event_type == "*"', 'timeline', false, false, 0, true),
              ('Collect all Crashes', '(event_type=="exception" && exception.handled==false)', 'sampled', true, false, 100, false),
              ('Collect all ANRs', '(event_type=="anr")', 'sampled', true, false, 100, false),
              ('Collect all Bug Reports', '(event_type=="bug_report")', 'sampled', false, false, 100, false),
              ('Collect sampled Cold Launch events', '(event_type=="cold_launch")', 'sampled', false, false, 1, false),
              ('Collect sampled Hot Launch events', '(event_type=="hot_launch")', 'sampled', false, false, 1, false),
              ('Collect sampled Warm Launch events', '(event_type=="warm_launch")', 'sampled', false, false, 1, false),
              ('Collect layout snapshots with clicks', '(event_type=="gesture_click")', 'timeline', false, true, 0, false)
      ) as rules(name, condition, collection_mode, take_screenshot, take_layout_snapshot, sampling_rate, is_default_behaviour);
    end if;

    -- Insert default session targeting rules only if table is empty
    if session_rules_count = 0 then
      insert into measure.session_targeting_rules (
          id,
          team_id,
          app_id,
          name,
          condition,
          sampling_rate,
          created_at,
          created_by
      )
      select
          gen_random_uuid(),
          a.team_id,
          a.id,
          rules.name,
          rules.condition,
          rules.sampling_rate,
          now(),
          migration_user_id
      from measure.apps a
      cross join (
          values
              ('Sessions with a Crash', '(event_type=="exception" && exception.handled==false)', 100),
              ('Sessions with an ANR', '(event_type=="anr")', 100),
              ('Sessions with a Bug Report', '(event_type=="bug_report")', 100)
      ) as rules(name, condition, sampling_rate);
    end if;

    -- Insert default trace targeting rule only if table is empty
    if trace_rules_count = 0 then
      insert into measure.trace_targeting_rules (
          id,
          team_id,
          app_id,
          name,
          condition,
          collection_mode,
          sampling_rate,
          is_default_behaviour,
          created_at,
          created_by
      )
      select
          gen_random_uuid(),
          a.team_id,
          a.id,
          'Collect all traces at 0.1 percent sampling rate',
          'span.name == "*"',
          'sampled',
          0.1,
          true,
          now(),
          migration_user_id
      from measure.apps a;
    end if;
  end;
  $$;
EOF
  then
    echo "Failed to add default targeting rules"
    shutdown_postgres_service
    return 1
  fi

  echo "Successfully added default targeting rules"
  shutdown_postgres_service
}

# kick things off
check_base_dir
set_docker_compose
add_default_targeting_rules