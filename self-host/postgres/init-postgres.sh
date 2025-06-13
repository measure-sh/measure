#!/usr/bin/env bash

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS measure;

-- Check if apps table exists in 'public' schema
-- and if apps does not exists in 'measure' schema
-- then migrate all tables & sequences from 'public'
-- schema to 'measure' schema.
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 from information_schema.tables WHERE table_schema = 'public' AND table_name = 'apps') AND NOT EXISTS (SELECT 1 from information_schema.tables WHERE table_schema = 'measure' AND table_name = 'apps') THEN

    -- Move all tables from 'public' to 'measure' schema
    FOR TBL in SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    LOOP
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA measure', TBL);
    END LOOP;

    -- Move all sequences from 'public' to 'measure' schema
    FOR SEQ IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
    LOOP
      EXECUTE format('ALTER SEQUENCE public.%I SET SCHEMA measure', SEQ);
    END LOOP;
  END IF;
END;
\$\$;

-- Create roles, grant permissions and create users.
-- Idempotent, safe to run on every startup.
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'operator') THEN
    CREATE ROLE operator;
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'reader') THEN
    CREATE ROLE reader;
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
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'measure_operator') THEN
    CREATE USER measure_operator WITH PASSWORD '${POSTGRES_OPERATOR_PASSWORD}';
  END IF;
  GRANT operator TO measure_operator;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'measure_reader') THEN
    CREATE USER measure_reader WITH PASSWORD '${POSTGRES_READER_PASSWORD}';
  END IF;
  GRANT reader TO measure_reader;
END
\$\$;
EOSQL
