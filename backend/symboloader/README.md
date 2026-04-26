# symboloader

Enumerates and uploads Apple iOS system framework symbols to an S3-compatible
bucket (self-host) or a GCS bucket (Cloud Run) for use in symbolication.

## Commands

```
symboloader sync [flags]    Run the full symbol sync pipeline
```

### sync flags

| Flag | Default | Description |
|---|---|---|
| `--versions` | last 5 versions | Target iOS versions (e.g. `"18.x"`, `"17.6.1"`) |
| `--concurrency` | `4` | Number of archives to process in parallel |
| `--dry-run` | `false` | Show download plan without executing |
| `--force` | `false` | Reprocess archives already recorded in the manifest |
| `--list` | `false` | List available versions and exit |

## Environment variables

### Storage (required)

The destination is selected automatically: a Cloud Run job (detected via
`CLOUD_RUN_JOB` and `CLOUD_RUN_EXECUTION` env vars set by the runtime) writes
to GCS; everything else writes to an S3-compatible store.

| Variable | Required when | Description |
|---|---|---|
| `SYSTEM_SYMBOLS_S3_BUCKET` | always | Bucket name. In Cloud Run this is the GCS bucket; everywhere else, the S3 bucket. |
| `SYMBOLS_S3_BUCKET_REGION` | self-host | AWS region (e.g. `us-east-1`) |
| `AWS_ENDPOINT_URL` | self-host (MinIO) | Custom endpoint for S3-compatible stores |
| `SYMBOLS_ACCESS_KEY` | self-host | Access key ID |
| `SYMBOLS_SECRET_ACCESS_KEY` | self-host | Secret access key |

In Cloud Run, the job's attached service account must have
`roles/storage.objectUser` on the destination bucket. No keys or endpoint are
needed — credentials are resolved via the metadata server.

### Google Drive API key (required)

Drive access uses an API key only — there is no service account requirement.
The upstream catalog folders are public, so the key is sufficient for both
listing files and downloading archives.

| Variable | Description |
|---|---|
| `GOOGLE_DRIVE_API_KEY` | API key value |
| `DRIVE_API_KEY_FILE` | Path to a file containing the API key (for Docker secrets) |

`GOOGLE_DRIVE_API_KEY` takes priority over `DRIVE_API_KEY_FILE`. Sync fails
fast at the validate stage if neither is set.

## Deployment

### Local development

```sh
export GOOGLE_DRIVE_API_KEY=<api-key>
export SYSTEM_SYMBOLS_S3_BUCKET=symbols
export SYMBOLS_S3_BUCKET_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:9000
export SYMBOLS_ACCESS_KEY=minioadmin
export SYMBOLS_SECRET_ACCESS_KEY=minioadmin

go run cmd/symboloader/main.go sync --versions "18.x"
```

### Docker / self-host

The Drive API key is passed as a Docker secret:

```yaml
secrets:
  drive-api-key:
    environment: "DRIVE_API_KEY"

services:
  symboloader:
    secrets:
      - drive-api-key
    environment:
      - DRIVE_API_KEY_FILE=/run/secrets/drive-api-key
      - SYSTEM_SYMBOLS_S3_BUCKET=symbols
      - SYMBOLS_S3_BUCKET_REGION=us-east-1
      - AWS_ENDPOINT_URL=http://minio:9000
      - SYMBOLS_ACCESS_KEY=...
      - SYMBOLS_SECRET_ACCESS_KEY=...
```

### Cloud Run

Attach a service account to the Cloud Run job. The SA needs **only**
`roles/storage.objectUser` on the destination GCS bucket — Drive access still
goes through the API key, so no Drive scope is required on the SA.

Required setup:

- SA bound to the Cloud Run job with `roles/storage.objectUser` on the GCS
  bucket.
- `SYSTEM_SYMBOLS_S3_BUCKET` set to the GCS bucket name. The S3-only variables
  (`SYMBOLS_S3_BUCKET_REGION`, `SYMBOLS_ACCESS_KEY`, `SYMBOLS_SECRET_ACCESS_KEY`,
  `AWS_ENDPOINT_URL`) are unused and may be omitted.
- `GOOGLE_DRIVE_API_KEY` (or `DRIVE_API_KEY_FILE`) configured the same way as
  self-host.

## Operational requirements

### Run at most one execution at a time

The pipeline records progress in `manifest.toml` at the bucket root using a
read-modify-write pattern. Two overlapping executions can both load the same
manifest, append different entries, and the second writer will overwrite the
first writer's append.

Symbol objects are content-addressed (`<debugID>/debuginfo`, `<debugID>/meta`)
and idempotent, so this never causes incorrect symbolication. But a dropped
manifest entry will cause the next run to re-download the archive from Drive
and re-upload identical bytes, wasting Drive API quota and Cloud Run time.

Configure your scheduler so executions cannot overlap:

- Cloud Run Jobs: do not trigger a new execution while one is still running.
- Cloud Scheduler: set an attempt deadline shorter than the schedule interval,
  and verify no manual triggers overlap a scheduled run.

When triggering manually, confirm no execution is already in progress.

### About `manifest.toml`

`manifest.toml` is bookkeeping. It records every successfully processed
archive's `(version, build, arch, md5Checksum)` so subsequent runs skip
already-uploaded content. It also serves as an audit log of historical runs
for operators. It is not required for symbolication correctness — symbol
objects in the bucket are the source of truth.

Each archive's MD5 checksum is also verified against the source after download
and before upload, so partial or corrupted downloads fail fast.
