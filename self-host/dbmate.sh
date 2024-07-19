#!/usr/bin/env sh

# postgres
dbmate --env POSTGERS_DSN --migrations-dir /opt/postgres status
dbmate --env POSTGRES_DSN --migrations-dir /opt/postgres migrate

# clickhouse
dbmate --url=$CLICKHOUSE_DSN --migrations-dir=/opt/clickhouse status
dbmate --url=$CLICKHOUSE_DSN --migrations-dir=/opt/clickhouse migrate

exec "$@"