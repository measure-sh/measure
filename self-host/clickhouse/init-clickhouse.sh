#!/usr/bin/env bash

set -euo pipefail

# Primary database name
DB_NAME=measure

clickhouse-client -n \
  --user "${CLICKHOUSE_USER}" \
  --password "${CLICKHOUSE_PASSWORD}" \
  --query "create user if not exists '${CLICKHOUSE_ADMIN_USER}' identified with sha256_password by '${CLICKHOUSE_ADMIN_PASSWORD}'" \
  --query "grant current grants on *.* to '${CLICKHOUSE_ADMIN_USER}' with grant option;" \
  --query "CREATE DATABASE IF NOT EXISTS $DB_NAME;"

clickhouse-client -n \
  --database "$DB_NAME" \
  --user "${CLICKHOUSE_ADMIN_USER}" \
  --password "${CLICKHOUSE_ADMIN_PASSWORD}" \
  <<-EOSQL
  create role if not exists operator;
  create role if not exists reader;
  grant select, insert, delete, update on $DB_NAME.* to operator;
  grant select on $DB_NAME.* to reader;

  create user if not exists '${CLICKHOUSE_OPERATOR_USER}' identified with sha256_password by '${CLICKHOUSE_OPERATOR_PASSWORD}' default role operator default database $DB_NAME;

  create user if not exists '${CLICKHOUSE_READER_USER}' identified with sha256_password by '${CLICKHOUSE_READER_PASSWORD}' default role reader default database $DB_NAME;

  GRANT ALL ON $DB_NAME.* TO operator;
  GRANT SELECT ON $DB_NAME.* TO reader;

  -- agent_sql: read-only role for the agent service's LLM-generated SQL.
  -- Scoped to events & spans only; team isolation enforced via a per-query
  -- custom setting (SQL_agent_team_id) read by the agent_team_isolation
  -- row policy. Fail-closed: empty default matches no rows.
  create role if not exists agent_sql;
  grant select on $DB_NAME.events to agent_sql;
  grant select on $DB_NAME.spans  to agent_sql;
  alter role agent_sql settings SQL_agent_team_id = '' CHANGEABLE_IN_READONLY;

  create row policy if not exists agent_team_isolation on $DB_NAME.*
    for select using team_id = toUUIDOrZero(getSetting('SQL_agent_team_id')) to agent_sql;

  create user if not exists '${CLICKHOUSE_AGENT_SQL_USER}' identified with sha256_password by '${CLICKHOUSE_AGENT_SQL_PASSWORD}' default role agent_sql default database $DB_NAME;

  -- reader role: team isolation via per-query custom setting.
  -- Fail-closed: empty default matches no rows. Every reader-pool query
  -- must set SQL_reader_team_id (done in the Go libs via chctx.WithReaderTeamScope).
  alter role reader settings SQL_reader_team_id = '' CHANGEABLE_IN_READONLY;

  create row policy if not exists team_isolation on $DB_NAME.*
    for select using team_id = toUUIDOrZero(getSetting('SQL_reader_team_id')) to reader;
EOSQL
