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
> - [ClickHouse SQL Reference](https://clickhouse.com/docs/en/sql-reference)

## Migration Guidelines

- **Always** write idempotent migrations
- **Always** write both `up` &amp; `down` migrations
  - When a natural `down` migration is not possible, use `select 1;` as a dummy.
- **Always** Follow this naming convention for naming migration files
  - Syntax: `<sql-command>-<entity-name>-<entity-type>`
  - `<sql-command>` should be `create` or `alter` etc sql commands
  - `<entity-name>` should be name of the table or role or function or trigger etc
  - `<entity-type>` should be name of the sql entity type, like `table`, `function`, `role`, `index`, `trigger`
  - Examples:
    - `create_sessions_table`
    - `create_sessions_attachments_table`
    - `create_create_team_function`
    - `create_create_team_for_user_trigger`
- **Always** describe each column using `comment column`
- **Always** write separate migrations for mutations and metadata updates.
  - Write separate migration for `comment colum`
  - Write separate migration for `materialize index`

    ### 🔴 Avoid this

    ```sql
    -- migrate:up
    alter table quux
      add column if not exists foo.bar UInt8 after bar.baz, comment column foo.bar 'example column';

    -- migrate:down
    alter table quux
      drop column if exists foo.bar;
    ```

    ### 🟢 Follow this

    Write separate migrations for `add column` and `comment column`.

    ```sql
    -- migrate:up
    alter table quux
      add column if not exists foo.bar UInt8 after bar.baz;

    -- migrate:down
    alter table quux
      drop column if exists foo.bar;
    ```

    ```sql
    -- migrate:up
    alter table quux
      comment column if exists foo.bar 'example column';

    -- migrate:down
    alter table quux
      modify column if exists foo.bar remove comment;
    ```

    ### 🔴 Avoid this

    Write separate migrations for `materialize index`.

    ```sql
    -- migrate:up
    alter table quux
      add index if not exists foo_bar_idx foo.bar type minmax granularity 2,
      materiaize index if exists foo_bar_idx;
    
    -- migrate:down
    alter table quux
      drop index if exists foo_bar_idx;
    ```

    ### 🟢 Follow this

    ```sql
    -- migrate:up
    alter table quux
      add index if not exists foo_bar_idx foo.bar type minmax granularity 2;

    -- migrate:down
    alter table quux
      drop index if exists foo_bar_idx;
    ```

    ```sql
    -- migrate:up
    alter table quux
      materialize index if exists foo_bar_idx;

    -- migrate:down
    alter table quux
      clear index if exists foo_bar_idx;
    ```
- **Never** specify the `.sql` file extension at the end. The extension is appended automatically.
- **Never** prefix the schema/database name in your objects
- **Never** edit the generated `schema.sql` file manually

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
docker compose run --rm dbmate-clickhouse new create_users_table
docker compose run --rm dbmate-clickhouse new allter_events_table
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

### Create new table

```sql
-- migrate:up
create table if not exists events (
    id UUID not null,
    app_id UUID not null,
    type FixedString(64),
    timestamp DateTime64(9, 'UTC')
)
engine = MergeTree
partition by toYYYYMM(timestamp)
order by (appId, timestamp, id)
sample by cityHash64(timestamp)
ttl timestamp + interval 90 day
settings
  index_granularity = 8192
;

-- migrate:down
drop table if exists events;
```

### Add column to table

```sql
-- migrate:up
alter table events
  add column if not exists `attribute.os_name` after `attribute.user_id`
  add index if not exists attribute_os_name_idx `attribute.os_name` type minmax granularity 2
;

-- migrate:down
alter table events
  drop column if exists `attribute.os_name`
;
```

```sql
-- migrate:up
alter table events
  comment column if exists `attribute.os_name` 'app operating system name'
;

-- migrate:down
alter table events
  modify column if exists `attribute.os_name` remove comment
;
```

```sql
-- migrate:up
alter table events
  materialize index if exists attribute_os_name_idx
;

-- migrate:down
alter table events
  clear index if exists attribute_os_name_idx
;
```