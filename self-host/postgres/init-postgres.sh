#!/usr/bin/env bash

set -euo pipefail

# Primary database name
DB_NAME=measure

# Primary schema name
SCHEMA_NAME=measure

# Create database if it doesn't exist
if ! psql -v ON_ERROR_STOP=1 -U postgres -d postgres -tAc "select 1 from pg_database where datname = '${DB_NAME}'" | grep -q 1; then
  echo "Creating '${DB_NAME}' database"
  createdb -U postgres -O postgres "${DB_NAME}"
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME};

-- Create roles, grant permissions and create users.
-- Idempotent, safe to run on every startup.
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'operator') THEN
    CREATE ROLE operator NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'reader') THEN
    CREATE ROLE reader NOLOGIN;
  END IF;
END
\$\$;

-- Grant schema usage
GRANT USAGE ON SCHEMA ${SCHEMA_NAME} TO operator;
GRANT USAGE ON SCHEMA ${SCHEMA_NAME} TO reader;

-- Grant privileges to roles
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${SCHEMA_NAME} TO operator;
ALTER DEFAULT PRIVILEGES IN SCHEMA ${SCHEMA_NAME} GRANT ALL ON TABLES TO operator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${SCHEMA_NAME} TO operator;
ALTER DEFAULT PRIVILEGES IN SCHEMA ${SCHEMA_NAME} GRANT ALL ON SEQUENCES TO operator;

GRANT SELECT ON ALL TABLES IN SCHEMA ${SCHEMA_NAME} TO reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA ${SCHEMA_NAME} GRANT SELECT ON TABLES to reader;

-- Create application users and assign them to roles
GRANT operator TO ${POSTGRES_USER};
GRANT reader TO ${POSTGRES_USER};
EOSQL
