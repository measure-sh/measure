## Ingest Worker Service

Receives `IngestBatch` messages from Google Pub/Sub (via HTTP push) and runs the full event processing pipeline. Designed to scale independently from the ingest service based on message backlog.

### Flow

```mermaid
flowchart TD
    PS[["☁️ Google Pub/Sub"]]

    subgraph WORKER["Ingest Worker Service"]
        direction TB
        PUSH["① POST /pubsub/push<br/>Decode · Deserialize IngestBatch"]
        SEEN{"② Already seen?<br/>checkSeen (idempotency)"}
        GEO["③ IP Geolocation<br/>Infuse country code"]
        SYM{"④ Symbolication<br/>Required?"}
        SYM_DO["Symbolicate events/spans"]
        INGEST["⑤ Ingest Events & Spans"]
        BUCKET["⑥ Bucket Exceptions & ANRs"]
        METRICS["⑦ Count Metrics"]
        REMEMBER["⑧ Remember batch"]
        ONBOARD["⑨ App onboarding<br/>(if applicable)"]
    end

    CH[("🗃 ClickHouse")]
    PG[("🐘 Postgres")]

    PS -->|"HTTP push"| PUSH
    PUSH -->|"invalid / decode error"| ERR(["❌ 400 Bad Request"])
    PUSH -->|"valid"| SEEN
    SEEN -->|"yes — skip"| ACK(["✅ 200 OK (no-op)"])
    SEEN -->|"no"| GEO
    GEO --> SYM
    SYM -->|"yes"| SYM_DO
    SYM_DO --> INGEST
    SYM -->|"no"| INGEST
    INGEST -->|"events · spans"| CH
    INGEST --> BUCKET
    BUCKET -->|"exception/ANR groups"| PG
    BUCKET --> METRICS
    METRICS -->|"app metrics"| PG
    METRICS --> REMEMBER
    REMEMBER -->|"mark batch ingested"| CH
    REMEMBER --> ONBOARD
    ONBOARD -->|"first batch flag"| PG

    style WORKER fill:#1e1e2e,stroke:#f38ba8,color:#cdd6f4
    style PS fill:#45475a,stroke:#a6e3a1,color:#cdd6f4
    style PUSH fill:#45475a,stroke:#f38ba8,color:#cdd6f4
    style SEEN fill:#45475a,stroke:#fab387,color:#cdd6f4
    style GEO fill:#45475a,stroke:#f38ba8,color:#cdd6f4
    style SYM fill:#45475a,stroke:#fab387,color:#cdd6f4
    style SYM_DO fill:#45475a,stroke:#fab387,color:#cdd6f4
    style INGEST fill:#45475a,stroke:#f38ba8,color:#cdd6f4
    style BUCKET fill:#45475a,stroke:#f38ba8,color:#cdd6f4
    style METRICS fill:#45475a,stroke:#f38ba8,color:#cdd6f4
    style REMEMBER fill:#45475a,stroke:#f38ba8,color:#cdd6f4
    style ONBOARD fill:#45475a,stroke:#f38ba8,color:#cdd6f4
    style CH fill:#313244,stroke:#f38ba8,color:#cdd6f4
    style PG fill:#313244,stroke:#89b4fa,color:#cdd6f4
    style ERR fill:#313244,stroke:#f38ba8,color:#f38ba8
    style ACK fill:#313244,stroke:#a6e3a1,color:#a6e3a1
```

### Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ping` | Health check |
| `POST` | `/pubsub/push` | Pub/Sub push endpoint |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_DSN` | Yes | PostgreSQL connection string |
| `CLICKHOUSE_DSN` | Yes | ClickHouse connection string |
| `REDIS_HOST` | Yes | Valkey/Redis host |
| `REDIS_PORT` | Yes | Valkey/Redis port |
| `SYMBOLICATOR_ORIGIN` | Yes | Origin URL of the symbolicator service |
| `API_ORIGIN` | Yes | Origin URL of the API service |
| `SYMBOLS_S3_BUCKET` | Yes | S3 bucket for mapping files |
| `SYMBOLS_S3_BUCKET_REGION` | Yes | Region of the symbols S3 bucket |
| `SYMBOLS_ACCESS_KEY` | Yes | Access key for symbols bucket |
| `SYMBOLS_SECRET_ACCESS_KEY` | Yes | Secret key for symbols bucket |
| `ATTACHMENTS_S3_BUCKET` | Yes | S3 bucket for attachments |
| `ATTACHMENTS_S3_BUCKET_REGION` | Yes | Region of the attachments S3 bucket |
| `ATTACHMENTS_ACCESS_KEY` | Yes | Access key for attachments bucket |
| `ATTACHMENTS_SECRET_ACCESS_KEY` | Yes | Secret key for attachments bucket |
| `AWS_ENDPOINT_URL` | No | Custom AWS endpoint (for local/self-hosted S3) |
| `OTEL_SERVICE_NAME` | No | Service name for OpenTelemetry traces/metrics |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | OTLP collector endpoint |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | No | OTLP protocol (`grpc` or `http`) |
| `INGEST_ENFORCE_TIME_WINDOW` | No | Reject events outside the allowed time window |
| `PORT` | No | HTTP port (default: `8086`) |
