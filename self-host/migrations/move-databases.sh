#!/usr/bin/env bash

set -euo pipefail

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

# Shutdown if measure compose services are up
shutdown_measure_services() {
  local running_services
  running_services=$(docker-compose ps -a -q | wc -l)
  if [[ "$running_services" -gt 0 ]]; then
    echo "Shutting down measure services..."
    $DOCKER_COMPOSE \
      --file compose.yml \
      --file compose.prod.yml \
      --profile init \
      --profile migrate \
      down
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

# Start the clickhouse service
start_clickhouse_service() {
  $DOCKER_COMPOSE \
    --file compose.yml \
    --file compose.prod.yml \
    up --wait -d clickhouse
}

# Shutdown the clickhouse service
shutdown_clickhouse_service() {
  $DOCKER_COMPOSE \
    --file compose.yml \
    --file compose.prod.yml \
    down clickhouse
}

# Get value of an environment variable
get_env_variable() {
  local env_file=".env"
  local var_name="$1"
  local var_value

  if [[ ! -f "$env_file" ]]; then
    echo "Error: $env_file file not found"
    return 1
  fi

  var_value=$(
    # shellcheck source=../.env
    source "$env_file" 2>/dev/null || exit 1

    if [[ -n "${!var_name}" ]]; then
      printf "%s" "${!var_name}"
    else
      exit 2
    fi
  )

  local subshell_exit_code=$?

  if [[ "$subshell_exit_code" -eq 2 ]]; then
    echo "Error: Variable '${var_name}' not found in '${env_file}'." >&2
    return 2
  elif [[ "$subshell_exit_code" -ne 0 ]]; then
    echo "Error: Failed to process '${var_name}' or extract variable '${var_name}'." >&2
    return 3
  fi

  printf "%s" "$var_value"
  return 0
}


# Migrate the postgres database
migrate_postgres_database() {
  echo "Migrating postgres database..."
  start_postgres_service
  if ! docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<-EOF
  create database measure with template postgres;
EOF
  then
    echo "Error: Failed to create 'measure' database." >&2
    shutdown_postgres_service
    return 1
  fi

  if ! docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d measure <<-EOF
  create schema if not exists measure;

  do \$\$
    declare
    table_record RECORD;
    sql_command TEXT;
  begin
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'apps') and not exists (select 1 from information_schema.tables where table_schema = 'measure' and table_name = 'apps') then
      -- move all tables from 'public' to 'measure' schema
      for table_record in select tablename from pg_tables where schemaname = 'public' order by tablename
      loop
        sql_command := format('alter table public.%I set schema measure;', table_record.tablename);
        execute sql_command;
      end loop;
    end if;
  end;
  \$\$;

  do \$\$
  begin
    if not exists (select from pg_catalog.pg_roles where rolname = 'operator') then
      create role operator nologin;
    end if;

    if not exists (select from pg_catalog.pg_roles where rolname = 'reader') then
      create role reader nologin;
    end if;
  end;
  \$\$;

  grant usage on schema measure to operator;
  grant usage on schema measure to reader;

  grant all privileges on all tables in schema measure to operator;
  alter default privileges in schema measure grant all on tables to operator;
  grant all privileges on all sequences in schema measure to operator;
  alter default privileges in schema measure grant all on sequences to operator;

  grant select on all tables in schema measure to reader;
  alter default privileges in schema measure grant select on tables to reader;

  grant operator to postgres;
  grant reader to postgres;
EOF
  then
    echo "Failed to grant privileges in postgres"
    shutdown_postgres_service
    return 1
  fi

  shutdown_postgres_service
}

# Migrate the clickhouse database
migrate_clickhouse_database() {
  local tables
  echo "Migrating clickhouse database..."
  start_clickhouse_service

  local admin_user
  local admin_password
  local dbname

  admin_user=$(get_env_variable CLICKHOUSE_ADMIN_USER)
  admin_password=$(get_env_variable CLICKHOUSE_ADMIN_PASSWORD)
  dbname=measure

  docker compose exec clickhouse clickhouse-client --query="create user if not exists $admin_user identified with sha256_password by '$admin_password';"
  docker compose exec clickhouse clickhouse-client --query="grant all on *.* to '$admin_user' with grant option;"
  docker compose exec clickhouse clickhouse-client --query="create database if not exists $dbname;"
  tables=$(docker compose exec clickhouse clickhouse-client --query="select name from system.tables where database = 'default';" --format=TabSeparatedRaw)

  if [[ -z $tables ]]; then
    echo "No tables found in the default ClickHouse database."
    shutdown_clickhouse_service
    return 0
  fi

  for table in $tables; do
    echo "  Moving table: $table"
    if ! docker compose exec clickhouse clickhouse-client --query="rename table default.$table to measure.$table;"
    then
      echo "Failed to move table $table"
      shutdown_clickhouse_service
      return 1
    fi
  done

  local operator_user
  local operator_password
  local reader_user
  local reader_password

  operator_user=$(get_env_variable CLICKHOUSE_OPERATOR_USER)
  operator_password=$(get_env_variable CLICKHOUSE_OPERATOR_PASSWORD)
  reader_user=$(get_env_variable CLICKHOUSE_READER_USER)
  reader_password=$(get_env_variable CLICKHOUSE_READER_PASSWORD)

  if ! docker compose exec clickhouse clickhouse-client --user "$admin_user" --password "$admin_password" \
    --query="create role if not exists operator;" \
    --query="create role if not exists reader;" \
    --query="grant select, insert on measure.* to operator;" \
    --query="grant select on measure.* to reader;" \
    --query="create user if not exists ${operator_user} identified with sha256_password by '${operator_password}' default role operator default database measure;" \
    --query="create user if not exists ${reader_user} identified with sha256_password by '${reader_password}' default role reader default database measure;" \
    --query="grant operator to ${operator_user};" \
    --query="grant reader to ${reader_user};"
  then
    echo "Failed to grant roles and privileges"
    shutdown_clickhouse_service
    return 1
  fi

  shutdown_clickhouse_service
}

# kick things off
check_base_dir
set_docker_compose
shutdown_measure_services
migrate_postgres_database
migrate_clickhouse_database
