## Measure Dev CLI

Use Measure Dev CLI to manage development operations like ingesting test sessions and so on.

### Ingesting Sessions

To ingest sessions from a local directory,

1. navigate to the local directory
2. copy example config - `cp config.toml.example config.toml`
3. edit `config.toml` to list your apps and their api keys
4. navigate to `./self-host/sessionator` and run.

```sh
go run . ingest
```

### Usage and Help

To see usage at root.

```sh
go run . --help
```

To see usage of a subcommand.

```sh
go run . ingest --help
```

### Repeat ingestion of sessions

During development, you will often want to clear the sessions data and re-ingest sessions again and again. Here's a step-by-step guide and few things to keep in mind.

1. Truncate Clickhouse tables. Execute SQL queries on the Clickhouse instance.

```sql
truncate table events;
```

2. Truncate Postgres tables. Execute SQL queries on the Postgres instance.

```sql
-- truncate mapping files
truncate table public.mapping_files;

-- truncate sesions, anr/exception groups
truncate table public.unhandled_exception_groups, public.anr_groups, public.sessions cascade;
```

3. Local uploading of files

When sessionator is running, the mapping and attachments files can be either configured to be uploaded to a remote S3 bucket or a local S3-compatible storage service. Like [minio](https://min.io/).

Make sure the `self-host/docker-compose.yml` file has the correct environment variables configured for minio to work.

Make sure `measure-backend/measure-go/.env` file has the `AWS_ENDPOINT_URL` environment variable pointing to the minio host url. Also, the bucket name, region and access key/secret must be configured correctly.

For symbolication to work, make sure `measure-backend/symbolicator-retrace/.env` file has the `AWS_ENDPONT_URL` variable pointing to the minio host. Also, the bucket name, region and access key/secret must be configured correctly.