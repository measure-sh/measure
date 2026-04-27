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
| `--workers` | `runtime.NumCPU()` | Number of parallel uploads per archive |
| `--dry-run` | `false` | Show download plan without executing |
| `--force` | `false` | Reprocess archives already recorded in the manifest |
| `--list` | `false` | List available versions and exit |
| `--no-removal` | `false` | Keep previously-synced symbols even if no longer in the target set |
| `--clone` | `false` | Wipe and `Files.copy()` catalog archives into `--drive-folder-id` before fetching (Cloud Run only) |
| `--drive-folder-id` | _(none)_ | Destination Drive folder ID for SA-owned copies; treats this folder as source for downloads (Cloud Run only) |

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

### Google Drive API key (required, no-flags path only)

Drive access uses an API key only when `--drive-folder-id` is not set.
The upstream catalog folders are public, so the key is sufficient for both
listing files and downloading archives.

| Variable | Description |
|---|---|
| `DRIVE_API_KEY` | API key value |
| `DRIVE_API_KEY_FILE` | Path to a file containing the API key (for Docker secrets) |

`DRIVE_API_KEY` takes priority over `DRIVE_API_KEY_FILE`. Sync fails
fast at the validate stage if neither is set and `--drive-folder-id` is not
provided.

## Deployment

### Local development

```sh
export DRIVE_API_KEY=<api-key>
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

Attach a service account to the Cloud Run job with **`roles/storage.objectUser`**
on the destination GCS bucket.

Required setup:

- SA bound to the Cloud Run job with `roles/storage.objectUser` on the GCS
  bucket.
- `SYSTEM_SYMBOLS_S3_BUCKET` set to the GCS bucket name. The S3-only variables
  (`SYMBOLS_S3_BUCKET_REGION`, `SYMBOLS_ACCESS_KEY`, `SYMBOLS_SECRET_ACCESS_KEY`,
  `AWS_ENDPOINT_URL`) are unused and may be omitted.

#### Recommended: cloned-mirror flow (`--clone` + `--drive-folder-id`)

The upstream Sentry symbol catalog files are public and shared with the world.
Drive enforces a per-file 24-hour download quota that is hit quickly under
real-world traffic — about 4 archives in our testing before subsequent ones
get rejected with `downloadQuotaExceeded`.

To bypass this, the sync command can run a server-side `Files.copy()` of every
catalog archive into a destination Drive folder owned by your SA. Downloads
against the SA-owned copies use the SA's own quota — orders of magnitude
higher than the per-public-file cap.

**Operator setup (one-time):**

1. Create a Shared Drive in your Workspace (typical SA "My Drive" 15 GiB is
   too small; iOS archive batches run ~50 GiB). Or, in a pinch, a folder in
   any Drive with sufficient free space.
2. Share the folder with the Cloud Run SA's email (`...@<project>.iam.gserviceaccount.com`)
   and grant it the **Editor** role.
3. Grant the SA the Drive scope `https://www.googleapis.com/auth/drive` so
   Application Default Credentials resolve it on Cloud Run. The SA does not
   need a service account key — the metadata server handles this automatically.
4. Note the folder ID (the trailing component of the Drive URL).

**Run:**

```sh
# First run, or any run after a new iOS release in the README
symboloader sync --clone --drive-folder-id <FOLDER_ID> --versions "last 5 versions"

# Subsequent runs (catalog hasn't changed) — copies already exist, no need to wipe
symboloader sync --drive-folder-id <FOLDER_ID> --versions "last 5 versions"
```

`--clone` always wipes every `.7z` in the destination folder before re-copying
fresh ones. The fetcher deletes each copy as soon as it has uploaded the
archive's symbols and persisted the manifest entry — so peak Drive storage
is bounded at `--concurrency × archive size` (~20 GiB at defaults).

If you omit `--clone --drive-folder-id` entirely, the CLI falls back to the
public-API-key path. This works for one-off runs but will hit the per-file
quota under repeated use.

#### Fallback: API-key-only path

`DRIVE_API_KEY` (or `DRIVE_API_KEY_FILE`) configured the same way as self-host.
Subject to upstream per-public-file quota — not recommended for production.

> Note: `--clone` and `--drive-folder-id` are currently Cloud-Run-only. The
> self-host path will still use the API-key flow.

## Operational requirements

### Run at most one execution at a time

The pipeline records progress across individual manifest files (see
[About `manifest/`](#about-manifest) below) using a read-modify-write pattern.
Two overlapping executions can both load the same manifest state, append
different entries, and the second writer will overwrite the first writer's
append.

Symbol objects are content-addressed (`<debugID>/debuginfo`, `<debugID>/meta`)
and idempotent, so this never causes incorrect symbolication. But a dropped
manifest entry will cause the next run to re-download the archive from Drive
and re-upload identical bytes, wasting Drive API quota and Cloud Run time.

Configure your scheduler so executions cannot overlap:

- Cloud Run Jobs: do not trigger a new execution while one is still running.
- Cloud Scheduler: set an attempt deadline shorter than the schedule interval,
  and verify no manual triggers overlap a scheduled run.

When triggering manually, confirm no execution is already in progress.

### About `manifest/`

`manifest/` is bookkeeping stored in the bucket. It is split into two
sub-prefixes:

- **`manifest/archives/<VBAC>.toml`** — one file per successfully processed
  archive. Records the version, build, arch, debug IDs uploaded, and
  completion time. Subsequent runs read these files to skip already-uploaded
  archives and the janitor reads them to track soft-deletions.
- **`manifest/runs/<run-id>.toml`** — one file per sync run. An audit log of
  which archives were added or removed in that run.

`manifest/` is bookkeeping, not source of truth for symbolication. Symbol
objects in the bucket are the authoritative data; a missing or corrupt manifest
entry only causes unnecessary re-work on the next run, not incorrect
symbolication results.
