## Sessionator

This tool is used to ingest test sessions for local development.

### Ingesting Sessions

To ingest sessions from a local directory,

1. Navigate to the local directory
2. Copy example config - `cp config.toml.example config.toml`
3. Edit `config.toml` to list your apps and their api keys and configure other settings.
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

For a clean ingest, run.

```sh
go run . ingest --clean
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

During development, you will often want to clear the sessions data and re-ingest sessions again and again. Using `--clean` on ingest will remove all data for the apps added in `session-data/config.toml` and re-ingest.

```sh
go run . ingest --clean
```

For `--clean` to work, you would need to configure the following settings in your `session-data/config.toml` file.

When ingesting events for newly created apps along with `--clean` flag, please mention the app name in the `name` field per app. The value of the `name` field must match exactly the name given when creating apps in Measure dashboard.

```toml
[apps.sample-app]
name = "your-app-name-1"
api-key = "msrsh_xxxxxx_xxxx"

[apps.wikipedia]
name = "your-app-name-2"
api-key = "msrsh_xxxxxx_xxxx"

[storage]
postgres_dsn = "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
clickhouse_dsn = "clickhouse://default:@127.0.0.1:9000/default"

aws_endpoint_url = "http://127.0.0.1:9119"

attachments_s3_bucket = "msr-attachments-sandbox"
attachments_s3_bucket_region = "us-east-1"
attachments_access_key = "minio"
attachments_secret_access_key = "minio123"

symbols_s3_bucket = "msr-symbols-sandbox"
symbols_s3_bucket_region = "us-east-1"
symbols_access_key = "minio"
symbols_secret_access_key = "minio123"
```

3. Local uploading of files

When sessionator is running, the mapping and attachments files can be either configured to be uploaded to a remote S3 bucket or a local S3-compatible storage service. Like [minio](https://min.io/).

Make sure the `self-host/docker-compose.yml` file has the correct environment variables configured for minio to work.

Make sure `backend/api/.env` file has the `AWS_ENDPOINT_URL` environment variable pointing to the minio host url. Also, the bucket name, region and access key/secret must be configured correctly.

For symbolication to work, make sure `backend/symbolicator-android/.env` file has the `AWS_ENDPONT_URL` variable pointing to the minio host. Also, the bucket name, region and access key/secret must be configured correctly.

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
