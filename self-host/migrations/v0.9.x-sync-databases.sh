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

# Shutdown if measure compose services are up
shutdown_measure_services() {
  local running_services
  running_services=$("$DOCKER_COMPOSE" ps -a -q | wc -l)
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

# Migrate the Postgres database
#
# - Creates the 'measure' database if it doesn't exist
# - Moves all tables from the 'public' schema to the 'measure' schema
# - Drops and recreates the 'public' schema for 'postgres' database
# - Creates 'operator' and 'reader' roles if they do not exist
# - Grants appropriate privileges to the 'operator' and 'reader' roles
migrate_postgres_database() {
  echo "Migrating postgres database..."
  start_postgres_service

  if ! $DOCKER_COMPOSE exec -T postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<-EOF
  do \$\$
  begin
    if not exists (select 1 from pg_database where datname = 'measure') then
      create database measure with template postgres;
    end if;
  end
  \$\$;
EOF
  then
    echo "Error: Failed to create or verify 'measure' database." >&2
    shutdown_postgres_service
    return 1
  fi

  if ! $DOCKER_COMPOSE exec -T postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d measure <<-EOF
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

  alter database measure set search_path to measure, "\$user", public;

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

  if ! $DOCKER_COMPOSE exec -T postgres psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<-EOF
  drop schema public cascade;
  create schema public;
  grant all on schema public to postgres;
  grant all on schema public to public;
EOF
  then
    echo "Error: Failed to recreate 'public' schema." >&2
    shutdown_postgres_service
    return 1
  fi

  shutdown_postgres_service
}

# Migrate the ClickHouse database
#
# - Ensures the admin user exists and has all privileges
# - Creates the 'measure' database if it doesn't exist
# - Moves all tables from the 'default' database to the 'measure' database
# - Creates 'operator' and 'reader' roles & users with appropriate permissions
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

  $DOCKER_COMPOSE exec clickhouse clickhouse-client --query="create user if not exists $admin_user identified with sha256_password by '$admin_password';"
  $DOCKER_COMPOSE exec clickhouse clickhouse-client --query="grant all on *.* to '$admin_user' with grant option;"
  $DOCKER_COMPOSE exec clickhouse clickhouse-client --query="create database if not exists $dbname;"
  tables=$($DOCKER_COMPOSE exec clickhouse clickhouse-client --query="select name from system.tables where database = 'default';" --format=TabSeparatedRaw)

  if [[ -z $tables ]]; then
    echo "No tables found in the default ClickHouse database."
  fi

  for table in $tables; do
    echo "  Moving table: $table"
    if ! $DOCKER_COMPOSE exec clickhouse clickhouse-client --query="rename table default.$table to measure.$table;"
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

  if ! $DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "$admin_user" \
    --password "$admin_password" \
    --query "create role if not exists operator;" \
    --query "create role if not exists reader;" \
    --query "grant select, insert, delete, update on measure.* to operator;" \
    --query "grant select on measure.* to reader;" \
    --query "create user if not exists ${operator_user} identified with sha256_password by '${operator_password}' default role operator default database measure;" \
    --query "create user if not exists ${reader_user} identified with sha256_password by '${reader_password}' default role reader default database measure;" \
    --query "grant operator to ${operator_user};" \
    --query "grant reader to ${reader_user};"
  then
    echo "Failed to grant roles and privileges"
    shutdown_clickhouse_service
    return 1
  fi

  # migrate existing materlized views

  # Step 1: Get list of relevant MVs and their create queries
  MVS=$($DOCKER_COMPOSE exec clickhouse clickhouse-client \
    --user "$admin_user" \
    --password "$admin_password" \
    --database "$dbname" \
    --query "SELECT name, create_table_query FROM system.tables WHERE engine = 'MaterializedView' AND database = 'measure' AND create_table_query ILIKE '%default.%' FORMAT CSVWithNames")

  # Step 2: Loop over each MV, skipping header
  echo "$MVS" | tail -n +2 | while IFS= read -r line; do
    if [ -z "$line" ]; then continue; fi

    # Extract mv_name (first CSV field, unquote)
    mv_name=$(echo "$line" | cut -d',' -f1 | sed 's/^"//; s/"$//')

    # Extract create_query (rest of line, unquote, unescape "" if any)
    create_query=$(echo "$line" | cut -d',' -f2- | sed 's/^"//; s/"$//; s/""/"/g')

    if [ -z "$mv_name" ]; then
      echo "Error: Could not extract MV name"
      continue
    fi

    echo "  Moving materialized view: $mv_name"

    # Step 3: Modify MV create query: replace all default. with measure.
    new_mv_create=${create_query//default./measure.}

    # Step 4: Drop old MV
    if ! $DOCKER_COMPOSE exec -T clickhouse clickhouse-client \
      --user "$admin_user" \
      --password "$admin_password" \
      --database "$dbname" \
      --query "DROP TABLE measure.$mv_name" < /dev/null
    then
      echo "Error: Failed to drop MV $mv_name"
      continue
    fi

    # Step 5: Recreate MV with new query (this should create the new target table)
    if ! $DOCKER_COMPOSE exec -T clickhouse clickhouse-client \
      --user "$admin_user" \
      --password "$admin_password" \
      --database "$dbname" \
      --query "$new_mv_create" < /dev/null
    then
      echo "Error: Failed to recreate MV $mv_name"
      continue
    fi

  done

  shutdown_clickhouse_service
}

# kick things off
check_base_dir
set_docker_compose
shutdown_measure_services
migrate_postgres_database
migrate_clickhouse_database
