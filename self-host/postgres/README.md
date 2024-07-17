# Postgres Schema Migrations

Schema migrations for postgres instances are managed using [dbmate](https://github.com/amacneil/dbmate).

## Notes

- migrations are stored in the `dbmate.schema_migrations` table
- it is safe to rename a migration file before or after applying the migration

## Migration Guidelines

- Migrations **MUST** be idempotent
- Migrations **MUST** contain both `up` &amp; `down` migrations
- **NEVER** edit the generated `schema.sql` file manually
- Follow this naming convention for naming migration files
  - Syntax: `<sql-command>_<entity-name>_<entity-type>`
  - `<sql-command>` should be `create` or `alter` etc sql commands
  - `<entity-name>` should be name of the relation or role or function or trigger etc
  - `<entity-type>` should be name of the sql entity type, like `table`, `function`, `role`, `index`, `trigger`
  - Examples:
    - `dbmate new create_sessions_table`
    - `dbmate new create_sessions_attachments_table`
    - `dbmate new create_create_team_function`
    - `dbmate new create_create_team_for_user_trigger`
    - `dbmate new alter_teams_relation` - add a new column
- When authoring migrations, always prefix the schema name in your objects

## Deleting old migrations

Though, generally not recommended, if you want to delete old migration files or squash multiple migration files into one, run the `./rigmarole.sh` script after deleting `.sql` files. This script will rollback all pending migrations and then re-run them. Read on to fully understand the consequences.

* Data from all tables **WILL** get deleted
* Before running `./rigmarole.sh`, manually truncate the `dbmate.schema_migrations` table by running the following SQL.
  
  ```sql
  truncate table if exists dbmate.schema_migrations;
  ```

  Using `psql` from postgres docker container. Make sure, docker compose is up. [More info](../README.md).

  ```sh
  # syntax
  docker exec -it <container-name> \
    psql <dsn> \
    -c "truncate table if exists dbmate.schema_migrations;"

  # example
  docker exec -it postgres \
    psql postgresql://postgres:postgres@postgres:5432/postgres \
    -c 'truncate table if exists dbmate.schema_migrations;'
  ```

* Run `./rigmarole.sh`

## Examples

### Creating tables

```sql
-- migrate:up
create table if not exists public.employees (
    id uuid primary key not null,
    name text
);

-- migrate:down
drop table if exists public.employees;
```

## Reset

Run the `./rigmarole.sh` script to rollback all migrations and re-apply again. This will effectively reset the entire database &amp; clear all data. Note that, this will not delete records from the `auth.users` table.