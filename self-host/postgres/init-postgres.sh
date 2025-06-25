#!/usr/bin/env bash

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS measure;

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
GRANT USAGE ON SCHEMA measure TO operator;
GRANT USAGE ON SCHEMA measure TO reader;

-- Grant privileges to roles
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA measure TO operator;
ALTER DEFAULT PRIVILEGES IN SCHEMA measure GRANT ALL ON TABLES TO operator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA measure TO operator;
ALTER DEFAULT PRIVILEGES IN SCHEMA measure GRANT ALL ON SEQUENCES TO operator;

GRANT SELECT ON ALL TABLES IN SCHEMA measure TO reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA measure GRANT SELECT ON TABLES to reader;

-- Create application users and assign them to roles
GRANT operator TO ${POSTGRES_USER};
GRANT reader TO ${POSTGRES_USER};
EOSQL
