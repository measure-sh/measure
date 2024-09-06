# ClickHouse Schema Migrations

Schema migrations for ClickHouse database are managed using the `dbmate-clickhouse` docker compose service. This service wraps the [dbmate](https://github.com/amacneil/dbmate)'s docker image configured for communicating to Measure's `clickhouse` compose service.


> [!NOTE]
>
> ## Before you proceed
>
> - ClickHouse migrations files are located at `self-host/clickhouse/*`
> - Migrations are stored in the `dbmate.schema_migrations` table
> - It is safe to rename a migration file before or after applying the migration
> - Always change to `cd self-host` directory first before running any database operations

## Migration Guidelines

- Migrations **MUST** be idempotent
- Migrations **MUST** contain both `up` &amp; `down` migrations
- **NEVER** edit the generated `schema.sql` file manually
- Follow this naming convention for naming migration files
  - Syntax: `<sql-command>-<entity-name>-<entity-type>`
  - `<sql-command>` should be `create` or `alter` etc sql commands
  - `<entity-name>` should be name of the table or role or function or trigger etc
  - `<entity-type>` should be name of the sql entity type, like `table`, `function`, `role`, `index`, `trigger`
  - Examples:
    - `create_sessions_table`
    - `create_sessions_attachments_table`
    - `create_create_team_function`
    - `create_create_team_for_user_trigger`
- Note that you don't need to specify the `.sql` file extension at the end. The extension gets appended automatically.
- When authoring migrations, always prefix the schema name in your objects

## ClickHouse Database Operations

During development, you may need to perform certain ClickHouse operations, like running migrations or reseting the entire ClickHouse database. We recommend the following commands for such database operations.

### View Status of ClickHouse Migrations

To view the status of the current ClickHouse migrations, run:

```sh
docker compose run --rm dbmate-clickhouse status
```

### Create a new ClickHouse Migration

To create a new ClickHouse migration, run:

```sh
docker compose run --rm dbmate-clickhouse new <migration-name>

# Example
docker compose run --rm dbmate-clickhouse new create-users-table
```

### Running ClickHouse Migrations

Use the built-in `dbmate-clickhouse` compose service to run ClickHouse migrations like this:

```sh
docker compose run --rm dbmate-clickhouse migrate
```

### Reset ClickHouse Database

To reset all data and run all migrations, run:

> [!CAUTION]
>
> ## Destructive Action
> 
> Resetting database will **DELETE** all data in your ClickHouse database.
> If you want need the data later, make sure you take a backup first.

```sh
docker compose run --rm --entrypoint /opt/clickhouse/rigmarole.sh dbmate-clickhouse
```

## Examples

Find a few examples of writing migration SQL scripts below.

### Creating tables

```sql
-- migrate:up
create table if not exists default.events (
    id uuid primary key not null,
    name text
);

-- migrate:down
drop table if exists default.events;
```