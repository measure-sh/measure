#!/usr/bin/env bash

set -euo pipefail

# This script migrates unhandled_exception_groups and anr_groups from Postgres tables to ClickHouse tables using Docker Compose.

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

echo "Starting Postgres to ClickHouse crash + anr groups migration"

# Truncate ClickHouse tables for idempotency
$DOCKER_COMPOSE exec -T clickhouse clickhouse-client --query "TRUNCATE TABLE IF EXISTS unhandled_exception_groups"
$DOCKER_COMPOSE exec -T clickhouse clickhouse-client --query "TRUNCATE TABLE IF EXISTS anr_groups"

echo "Migrating unhandled_exception_groups..."
TMP_TSV_UEG="/tmp/unhandled_exception_groups.tsv"
$DOCKER_COMPOSE exec -T postgres psql -U postgres -d postgres -c "\\copy (SELECT app_id, fingerprint, type, message, method_name, file_name, line_number, updated_at FROM public.unhandled_exception_groups) TO STDOUT WITH (FORMAT TEXT, DELIMITER E'\t', NULL '\\N')" > "$TMP_TSV_UEG"
if [ -s "$TMP_TSV_UEG" ]; then
  cat "$TMP_TSV_UEG" | sed -E 's/([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?)([+Z].*)?$/\1/' | \
  $DOCKER_COMPOSE exec -T clickhouse clickhouse-client --query "INSERT INTO unhandled_exception_groups (app_id, id, type, message, method_name, file_name, line_number, updated_at) FORMAT TSV"
fi
rm "$TMP_TSV_UEG"
echo "Migrating anr_groups..."
TMP_TSV_ANR="/tmp/anr_groups.tsv"
$DOCKER_COMPOSE exec -T postgres psql -U postgres -d postgres -c "\\copy (SELECT app_id, fingerprint, type, message, method_name, file_name, line_number, updated_at FROM public.anr_groups) TO STDOUT WITH (FORMAT TEXT, DELIMITER E'\t', NULL '\\N')" > "$TMP_TSV_ANR"
if [ -s "$TMP_TSV_ANR" ]; then
  cat "$TMP_TSV_ANR" | sed -E 's/([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?)([+Z].*)?$/\1/' | \
  $DOCKER_COMPOSE exec -T clickhouse clickhouse-client --query "INSERT INTO anr_groups (app_id, id, type, message, method_name, file_name, line_number, updated_at) FORMAT TSV"
fi
rm "$TMP_TSV_ANR"
echo "Migration complete."
