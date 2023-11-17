# Postgres Schema Migrations

Schema migrations for postgres instances are managed using [dbmate](https://github.com/amacneil/dbmate).

## Notes

- migrations are stored in the `dbmate.schema_migrations` table
- it is safe to rename a migration file before or after applying the migration

## Migration Guidelines

- Migrations **MUST** be idempotent
- Migrations **MUST** contain both `up` & `down` migrations
- **NEVER** edit the generated `schema.sql` file manually
- Follow this naming convention for naming migration files
  - Syntax: `<sql-command>-<entity-name>-<entity-type>`
  - `<sql-command>` should be `create` or `alter` etc sql commands
  - `<entity-name>` should be name of the relation or role or function or trigger etc
  - `<entity-type>` should be name of the sql entity type, like `relation`(or `table`), `function`, `role`, `index`, `trigger`
  - Examples:
    - `dbmate new create-sessions-relation`
    - `dbmate new create-sessions_attachments-relation`
    - `dbmate new create-create_team-function`
    - `dbmate new create-create_team_for_user-trigger`
- When authoring migrations, always prefix the schema name in your objects

## Examples

### Creating tables

```sql
create table if not exists public.employees (
    id uuid primary key not null,
    name text
);
```