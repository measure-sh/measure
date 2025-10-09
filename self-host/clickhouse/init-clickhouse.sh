#!/usr/env/bin bash

set -euo pipefail

# Primary database name
DB_NAME=measure

clickhouse-client \
  --user default \
  --query "create user '${CLICKHOUSE_ADMIN_USER}' identified with sha256_password by '${CLICKHOUSE_ADMIN_PASSWORD}'" \
  --query "grant all on *.* to '${CLICKHOUSE_ADMIN_USER}' with grant option;" \
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
EOSQL
