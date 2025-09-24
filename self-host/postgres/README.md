# Postgres Schema Migrations

Schema migrations for Postgres database are managed using the `dbmate-postgres` docker compose service. This service wraps the [dbmate](https://github.com/amacneil/dbmate)'s docker image configured for communicating to Measure's `postgres` compose service.

> [!NOTE]
>
> ## Before you proceed
>
> - Postgres migrations files are located at `self-host/postgres/*`
> - Migrations are stored in the `dbmate.schema_migrations` table
> - It is safe to rename a migration file before or after applying the migration
> - Always change to `cd self-host` directory first before running any database operations

## Migration Guidelines

- Migrations **MUST** be idempotent
- Migrations **MUST** contain both `up` &amp; `down` migrations
- **NEVER** edit the generated `schema.sql` file manually
- Follow this naming convention for naming migration files
  - Syntax: `<sql-command>_<entity-name>_<entity-type>`
  - `<sql-command>` should be `create` or `alter` etc sql commands
  - `<entity-name>` should be name of the table or role or function or trigger etc
  - `<entity-type>` should be name of the sql entity type, like `table`, `function`, `role`, `index`, `trigger`
  - Examples:
    - `create_sessions_table`
    - `create_sessions_attachments_table`
    - `create_create_team_function`
    - `create_create_team_for_user_trigger`
    - `alter_teams_table` - add a new column
- Note that you don't need to specify the `.sql` file extension at the end. The extension gets appended automatically.
- When authoring migrations, always prefix the schema name in your objects

## Postgres Database Operations

During development, you may need to perform certain Postgres operations, like running migrations or reseting the entire Postgres database. We recommend the following commands for such database operations.

### View Status of Postgres Migrations

To view the status of the current Postgres migrations, run:

```sh
docker compose run --rm dbmate-postgres status
```

### Create a new Postgres Migration

To create a new Postgres migration, run:

```sh
docker compose run --rm dbmate-postgres new <migration-name>

# Example
docker compose run --rm dbmate-postgres new create-users-table
```

### Running Postgres Migrations

Use the built-in `dbmate-postgres` compose service to run Postgres migrations like this:

```sh
docker compose run --rm dbmate-postgres migrate
```

### Reset Postgres Database

To reset all data and run all migrations, run:

> [!CAUTION]
>
> ## Destructive Action
>
> Resetting database will **DELETE** all data in your Postgres database.
> If you want need the data later, make sure you take a backup first.

```sh
docker compose run --rm --entrypoint /opt/postgres/rigmarole.sh dbmate-postgres
```

## Example Migrations

Find a few examples of writing migration SQL scripts below.

### Creating tables

```sql
-- migrate:up
create table if not exists measure.users (
    id uuid primary key not null,
    name text
);

-- migrate:down
drop table if exists measure.users;
```
