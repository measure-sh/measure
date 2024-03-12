## Measure Dev CLI

Use Measure Dev CLI to manage development operations like ingesting test sessions and so on.

### Ingesting Sessions

To ingest sessions from a local directory,

1. Navigate to the local directory
2. Copy example config - `cp config.toml.example config.toml`
3. Edit `config.toml` to list your apps and their api keys
4. Navigate to `./self-host/sessionator` and run.

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

5. Make sure the name of the directories under `self-host/session-data` matches the app names in the `self-host/session-data/config.toml` file.

For example:

```toml
[apps.sample-app]
api-key = "msrsh_xxxxxx_xxxx"

[apps.wikipedia]
api-key = "msrsh_xxxxxx_xxxx"
```

For the above configuration to work, the app directory names must match.

```
self-host/
├─ session-data/
├─ ├─ sample-app/
├─ ├─ wikipedia/
```

### Repeat ingestion of sessions

During development, you will often want to clear the sessions data and re-ingest sessions again and again. Here's a step-by-step guide and few things to keep in mind.

1. Truncate Clickhouse tables. Execute SQL queries on the Clickhouse instance.

```sql
truncate table events;
```

2. Truncate Postgres tables. Execute SQL queries on the Postgres instance.

```sql

-- truncate anr/exception groups, build info, sessions
truncate table public.unhandled_exception_groups, public.anr_groups, public.build_mappings, public.build_sizes, public.sessions cascade;
```

3. Local uploading of files

When sessionator is running, the mapping and attachments files can be either configured to be uploaded to a remote S3 bucket or a local S3-compatible storage service. Like [minio](https://min.io/).

Make sure the `self-host/docker-compose.yml` file has the correct environment variables configured for minio to work.

Make sure `measure-backend/measure-go/.env` file has the `AWS_ENDPOINT_URL` environment variable pointing to the minio host url. Also, the bucket name, region and access key/secret must be configured correctly.

For symbolication to work, make sure `measure-backend/symbolicator-retrace/.env` file has the `AWS_ENDPONT_URL` variable pointing to the minio host. Also, the bucket name, region and access key/secret must be configured correctly.

### Recording sessions or mappings

To record sessions or mappings to a local directory, navigate to `./self-host/sessionator` and run

```sh
go run . record
```

* to record sessions from an Android emulator, set following in `~/.gradle.properties`:

```sh
measure_url=http://10.0.2.2:8080
```

* to record sessions from an Android device, use a service like [tunnelmole](https://tunnelmole.com/) to forward requests from the device to localhost.


* to record mappings, run a assemble task, the mapping will be added to the local directory, `self-host/session-data`.
