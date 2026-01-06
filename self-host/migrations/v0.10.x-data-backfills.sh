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

# Add default SDK config
add_default_sdk_config() {
  echo "Adding default SDK config..."
  start_postgres_service

  if ! $DOCKER_COMPOSE exec -T postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d measure <<-'EOF'
  do $$
    declare
        migration_user_id uuid;
    begin
        -- Use nil UUID for migration user
        migration_user_id := '00000000-0000-0000-0000-000000000000'::uuid;

        -- Insert default SDK config for apps that don't have one yet
        insert into measure.sdk_config (
            team_id,
            app_id,
            max_events_in_batch,
            crash_timeline_duration,
            anr_timeline_duration,
            bug_report_timeline_duration,
            trace_sampling_rate,
            journey_sampling_rate,
            screenshot_mask_level,
            cpu_usage_interval,
            memory_usage_interval,
            crash_take_screenshot,
            anr_take_screenshot,
            launch_sampling_rate,
            gesture_click_take_snapshot,
            http_disable_event_for_urls,
            http_track_request_for_urls,
            http_track_response_for_urls,
            http_blocked_headers,
            updated_at,
            updated_by
        )
        select
          a.team_id,
          a.id,
          10000,
          300,
          300,
          300,
          0.01,
          0.01,
          'all_text_and_media',
          5,
          5,
          true,
          true,
          0.01,
          true,
          '{}',
          '{}',
          '{}',
          '{}',
          now(),
          migration_user_id
      from measure.apps a
        where not exists (
            select 1 from measure.sdk_config sc where sc.app_id = a.id
        );
    end;
  $$;
EOF
  then
    echo "Failed to add default SDK config"
    shutdown_postgres_service
    return 1
  fi

  echo "Successfully added default SDK config"
  shutdown_postgres_service
}

# kick things off
check_base_dir
set_docker_compose
add_default_sdk_config
