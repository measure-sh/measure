# symboloader

Enumerates, clones, and uploads Apple iOS system framework symbols to an
S3-compatible bucket (self-host) or a GCS bucket (Cloud Run) for use in
symbolication.

## Commands

```
symboloader sync [flags]    Run the full symbol sync pipeline
```

### sync flags

| Flag | Default | Description |
|---|---|---|
| `--versions` | last 5 versions | Target iOS versions (e.g. `"18.x"`, `"17.6.1"`) |
| `--concurrency` | `4` | Number of archives to process in parallel |
| `--drive-folder` | `symboloader` | Google Drive destination folder name (created if missing) |
| `--drive-folder-id` | — | Google Drive destination folder ID (takes priority over `--drive-folder`) |
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

### Google Drive credentials (required)

One of the following must be configured so the service account can access Google Drive:

| Variable | Description |
|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to a service account JSON key file |

Resolution order:
1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable
2. Application Default Credentials (ADC) — gcloud local credentials or the
   GCP metadata server (Cloud Run / GKE)

### Google Drive API key (optional)

Enables reading public source Drive folders without consuming service account quota.

| Variable | Description |
|---|---|
| `GOOGLE_DRIVE_API_KEY` | API key value |
| `DRIVE_API_KEY_FILE` | Path to a file containing the API key (for Docker secrets) |

`GOOGLE_DRIVE_API_KEY` takes priority over `DRIVE_API_KEY_FILE`.

## Deployment

### Local development

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json
export GOOGLE_DRIVE_API_KEY=<api-key>       # optional
export SYSTEM_SYMBOLS_S3_BUCKET=symbols
export SYMBOLS_S3_BUCKET_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:9000
export SYMBOLS_ACCESS_KEY=minioadmin
export SYMBOLS_SECRET_ACCESS_KEY=minioadmin

go run cmd/symboloader/main.go sync --versions "18.x"
```

### Docker / self-host

Credentials are passed as Docker secrets:

```yaml
secrets:
  service-account-key:
    file: ./sa-key.json
  drive-api-key:
    environment: "DRIVE_API_KEY"

services:
  symboloader:
    secrets:
      - service-account-key
      - drive-api-key
    environment:
      - GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/service-account-key
      - DRIVE_API_KEY_FILE=/run/secrets/drive-api-key
      - SYSTEM_SYMBOLS_S3_BUCKET=symbols
      - SYMBOLS_S3_BUCKET_REGION=us-east-1
      - AWS_ENDPOINT_URL=http://minio:9000
      - SYMBOLS_ACCESS_KEY=...
      - SYMBOLS_SECRET_ACCESS_KEY=...
```

### Cloud Run

Attach a service account to the Cloud Run job directly — no key file, no
environment variable. ADC resolves credentials from the metadata server, and
the same service account serves both Drive reads and GCS writes.

Required setup:

- The service account must have `roles/storage.objectUser` on the destination
  GCS bucket.
- The service account must have read access to the upstream Drive folders, or
  set `GOOGLE_DRIVE_API_KEY` / `DRIVE_API_KEY_FILE` to read public folders
  without consuming SA quota.
- Set `SYSTEM_SYMBOLS_S3_BUCKET` to the GCS bucket name. The S3-only variables
  (`SYMBOLS_S3_BUCKET_REGION`, `SYMBOLS_ACCESS_KEY`, `SYMBOLS_SECRET_ACCESS_KEY`,
  `AWS_ENDPOINT_URL`) are unused here and may be omitted.

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

`manifest.toml` is bookkeeping. The planner reads it to skip already-completed
`(version, build, arch)` tuples on subsequent runs, and it serves as an audit
log of historical runs for operators. It is not required for symbolication
correctness — symbol objects in the bucket are the source of truth.
