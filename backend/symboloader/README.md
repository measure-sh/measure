# symboloader

Enumerates, clones, and uploads Apple iOS system framework symbols to an
S3-compatible bucket for use in symbolication.

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

| Variable | Description |
|---|---|
| `SYSTEM_SYMBOLS_S3_BUCKET` | S3 bucket name |
| `SYSTEM_SYMBOLS_S3_REGION` | AWS region (e.g. `us-east-1`) |
| `SYSTEM_SYMBOLS_S3_ENDPOINT` | Custom endpoint for S3-compatible stores (e.g. MinIO) |
| `SYSTEM_SYMBOLS_S3_ACCESS_KEY_ID` | Access key ID |
| `SYSTEM_SYMBOLS_S3_SECRET_ACCESS_KEY` | Secret access key |

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
export SYSTEM_SYMBOLS_S3_REGION=us-east-1
export SYSTEM_SYMBOLS_S3_ENDPOINT=http://localhost:9000
export SYSTEM_SYMBOLS_S3_ACCESS_KEY_ID=minioadmin
export SYSTEM_SYMBOLS_S3_SECRET_ACCESS_KEY=minioadmin

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
      - SYSTEM_SYMBOLS_S3_REGION=us-east-1
      - SYSTEM_SYMBOLS_S3_ENDPOINT=http://minio:9000
      - SYSTEM_SYMBOLS_S3_ACCESS_KEY_ID=...
      - SYSTEM_SYMBOLS_S3_SECRET_ACCESS_KEY=...
```

### Cloud Run

Attach a service account to the Cloud Run job directly. No key file or
environment variable is needed — ADC reads credentials from the metadata server
automatically.
