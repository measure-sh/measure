#!/usr/env/bin bash

set -e

clickhouse-client -n --query "CREATE DATABASE IF NOT EXISTS measure;"

# If there are any tables in the 'default' database, move them to the 'measure'
# database.
TABLE_COUNT_DEFAULT=$(clickhouse-client -n --query "SELECT count() from system.tables WHERE database = 'default';")
TABLE_COUNT_MEASURE=$(clickhouse-client -n --query "SELECT count() from system.tables WHERE database = 'measure';")

if [[ "$TABLE_COUNT_DEFAULT" -gt 0 && "$TABLE_COUNT_MEASURE" -eq 0 ]]; then
  echo "Existing tables found in 'default' database. Migrating to 'measure' database."

  # Get all tables in the 'default' database and
  # rename them one by one.
  clickhouse-client -n --query "SELECT name from system.tables WHERE database = 'default' FORMAT TabSeparated" | while read -r TBL; do
    echo "Moving table: $TBL"
    clickhouse-client -n --query "RENAME TABLE default.$TBL TO measure.$TBL;"
  done
fi

clickhouse-client -n <<-EOSQL
  CREATE USER IF NOT EXISTS operator IDENTIFIED WITH sha256_password BY '${CLICKHOUSE_OPERATOR_PASSWORD}';
  CREATE USER IF NOT EXISTS admin IDENTIFIED WITH sha256_password BY '${CLICKHOUSE_READER_PASSWORD}';

  GRANT ALL ON measure.* TO operator;
  GRANT SELECT ON measure.* TO reader;
EOSQL
