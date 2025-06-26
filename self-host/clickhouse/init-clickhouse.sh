#!/usr/env/bin bash

set -e

clickhouse-client --query "CREATE DATABASE IF NOT EXISTS measure;"

clickhouse-client -n --database measure <<-EOSQL
  create role if not exists operator;
  create role if not exists reader;
  -- grant select, insert on measure.* to operator;
  -- grant select on measure.* to reader;

  create user if not exists '${CLICKHOUSE_OPERATOR_USER}' identified with sha256_password by '${CLICKHOUSE_OPERATOR_PASSWORD}' default role operator default database measure;

  create user if not exists '${CLICKHOUSE_READER_USER}' identified with sha256_password by '${CLICKHOUSE_READER_PASSWORD}' default role reader default database measure;

  GRANT ALL ON measure.* TO operator;
  GRANT SELECT ON measure.* TO reader;
EOSQL
