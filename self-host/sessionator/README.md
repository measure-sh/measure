## Sessionator <!-- omit in toc -->

Easily ingest test sessions during development.

## Contents <!-- omit in toc -->

- [Usage and Help](#usage-and-help)
- [Recording sessions and mappings](#recording-sessions-and-mappings)
- [Ingesting Sessions](#ingesting-sessions)
- [Repeat ingestion of sessions](#repeat-ingestion-of-sessions)
  - [`--clean-all` flag](#--clean-all-flag)
  - [`--clean` flag](#--clean-flag)
- [Skipping apps from ingestion](#skipping-apps-from-ingestion)
- [Delaying ingestion for builds to process](#delaying-ingestion-for-builds-to-process)
- [Uploading mappings \& attachments locally](#uploading-mappings--attachments-locally)
- [Remove apps completely](#remove-apps-completely)

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
go run . ingest --clean-all
```

### Recording sessions and mappings

To record sessions and mappings to a local directory, navigate to `./self-host/sessionator` and run

```sh
go run . record
```

* to record sessions from an Android emulator, set following in `~/.gradle.properties`:

```sh
measure_url=http://10.0.2.2:8080
```

* to record sessions from an Android device, use a service like [tunnelmole](https://tunnelmole.com/) to forward requests from the device to localhost.

* to record mappings, run a assemble task, the mapping will be added to the local directory, `self-host/session-data`.

### Ingesting Sessions

To ingest sessions from a local directory,

1. Navigate to the local directory
2. Copy example config - `cp config.toml.example config.toml`
3. Edit `config.toml` to list your apps and their api keys and configure other settings.
4. Navigate to `./self-host/sessionator` and run.

    ```sh
    go run . ingest
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

During development, you will often want to clear the sessions data and re-ingest sessions again and again. There are 2 ways to clean old data.

#### `--clean-all` flag

```sh
go run . ingest --clean-all
```

The `--clean-all` flag would remove all old data for **all** apps regardless of your settings in `config.toml`. Use this if you want to clean ingest from scratch.

#### `--clean` flag

```sh
go run . ingest --clean
```

The `--clean` flag would remove all old data for **only** matching apps in `config.toml`. Use this if you want to clear data for certain apps.

Additionally, when using `--clean` mention the app name in the `name` field per app, like this. The names should match exactly as the app names in Measure dashboard.

```toml
[apps.sample-app]
name = "your-app-name-1"
api-key = "msrsh_xxxxxx_xxxx"

[apps.wikipedia]
name = "your-app-name-2"
api-key = "msrsh_xxxxxx_xxxx"
```

Regardless of which method you choose, the `session-data/config.toml` needs the **`[storage]`** section to perform cleanups.

```toml
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

### Skipping apps from ingestion

You can skip certain apps during ingestion using the `--skip-apps` option. This can be useful in scenarios when you to ingest some apps partially.

```sh
go run . ingest --skip-apps com.example.appOne,com.example.appTwo
```

Sessionator will not scan the `com.example.appOne` and `com.example.appTwo` apps for the above. Note the app name must match the directory name under the `session-data` directory.

### Delaying ingestion for builds to process

Build are processed asynchronously. Without a delay, events that require symbolication will not be symbolicated if their related build mapping is
not ready yet. By default, the delay is set to 5 seconds. You can change this by setting the `-b/--build-process-delay` option.

```sh
go run . ingest --clean --build-process-delay 10s
```

### Uploading mappings & attachments locally

The mapping and attachment files can be either configured to be uploaded to a remote S3 bucket or a local S3-compatible storage service. Like [minio](https://min.io/).

For this to work, make sure `self-host/.env` has the `AWS_ENDPOINT_URL` environment variable pointing to the minio host url. Also, the bucket name, region and access key/secret must be configured correctly. These settings are required for symbolication to work correctly.

### Remove apps completely

The `ingest --clean/--clean-all` commands only removes the app's resources, but the apps themselves are not removed. If you wish to remove an app completely, use the `remove apps` command. Like below.

```sh
# syntax, where xxxx is the id of the app
go run . remove apps --id xxxx
```

You would need to get the id of the app from the `apps` table in Measure's Postgres database.
