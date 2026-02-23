# Network Queries

All queries target ClickHouse unless noted as PostgreSQL. Date range: last 2 months.

```
app_id:  cbfe4099-4591-4759-b615-8c038e98afd3
team_id: b31b7648-7a15-4c52-85e0-2748d0cb1911
```

## API Queries

### FetchDomains

```sql
SELECT domain
FROM http_events
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain != ''
GROUP BY domain
ORDER BY count() DESC
```

### FetchPaths

#### Primary: url_patterns

```sql
SELECT path
FROM url_patterns FINAL
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.measure.sh'
  AND positionCaseInsensitive(path, 'search') > 0
ORDER BY path
LIMIT 10
```

#### Fallback: http_events

```sql
SELECT path
FROM http_events
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.measure.sh'
  AND positionCaseInsensitive(path, 'search') > 0
GROUP BY path
ORDER BY count() DESC
LIMIT 10
```

### patternExists

```sql
SELECT 1
FROM url_patterns FINAL
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.measure.sh'
  AND path = '/api/users/*'
LIMIT 1
```

### fetchTrendsCategory

Called 3 times by FetchTrends with different ORDER BY: `p95_latency DESC`, `error_rate DESC`, `frequency DESC`.

```sql
SELECT
    domain,
    path AS path_pattern,
    quantilesMerge(0.5, 0.75, 0.90, 0.95, 0.99, 1.0)(latency_percentiles)[4] AS p95_latency,
    if(sum(request_count) > 0,
       (sum(count_4xx) + sum(count_5xx)) * 100.0 / sum(request_count),
       0) AS error_rate,
    sum(request_count) AS frequency
FROM http_metrics
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND timestamp >= now() - INTERVAL 2 MONTH
  AND timestamp <= now()
GROUP BY domain, path
ORDER BY p95_latency DESC
LIMIT 100
```

### fetchMetricsFromEvents — Latency

```sql
SELECT
    formatDateTime(timestamp, '%Y-%m-%d', 'UTC') as datetime,
    quantiles(0.50, 0.90, 0.95, 0.99)(latency_ms) as latencies,
    countIf(status_code >= 200 and status_code < 600) as count
FROM http_events
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.measure.sh'
  AND timestamp >= now() - INTERVAL 2 MONTH
  AND timestamp <= now()
  AND latency_ms <= 60000
  AND path LIKE '/api/users/%'
GROUP BY datetime
ORDER BY datetime
```

### fetchMetricsFromEvents — Status codes

```sql
SELECT
    formatDateTime(timestamp, '%Y-%m-%d', 'UTC') as datetime,
    countIf(status_code >= 200 and status_code < 600) as total_count,
    countIf(status_code >= 200 and status_code < 300) as count_2xx,
    countIf(status_code >= 300 and status_code < 400) as count_3xx,
    countIf(status_code >= 400 and status_code < 500) as count_4xx,
    countIf(status_code >= 500 and status_code < 600) as count_5xx
FROM http_events
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.measure.sh'
  AND timestamp >= now() - INTERVAL 2 MONTH
  AND timestamp <= now()
  AND status_code != 0
  AND latency_ms <= 60000
  AND path LIKE '/api/users/%'
GROUP BY datetime
ORDER BY datetime
```

### fetchMetricsFromAggregated — Latency

```sql
SELECT
    formatDateTime(timestamp, '%Y-%m-%d', 'UTC') as datetime,
    quantilesMerge(0.5, 0.75, 0.90, 0.95, 0.99, 1.0)(latency_percentiles) as latencies,
    sum(request_count) as count
FROM http_metrics
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.measure.sh'
  AND timestamp >= now() - INTERVAL 2 MONTH
  AND timestamp < now()
  AND path = '/api/users/*'
GROUP BY datetime
ORDER BY datetime
```

### fetchMetricsFromAggregated — Status codes

```sql
SELECT
    formatDateTime(timestamp, '%Y-%m-%d', 'UTC') as datetime,
    sum(request_count) as total_count,
    sum(count_2xx) as count_2xx,
    sum(count_3xx) as count_3xx,
    sum(count_4xx) as count_4xx,
    sum(count_5xx) as count_5xx
FROM http_metrics
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.measure.sh'
  AND timestamp >= now() - INTERVAL 2 MONTH
  AND timestamp < now()
  AND path = '/api/users/*'
GROUP BY datetime
ORDER BY datetime
```

### GetRequestStatusOverview

```sql
SELECT
    formatDateTime(timestamp, '%Y-%m-%d', 'UTC') as datetime,
    countIf(status_code >= 200 and status_code < 600) as total_count,
    countIf(status_code >= 200 and status_code < 300) as count_2xx,
    countIf(status_code >= 300 and status_code < 400) as count_3xx,
    countIf(status_code >= 400 and status_code < 500) as count_4xx,
    countIf(status_code >= 500 and status_code < 600) as count_5xx
FROM http_events
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND timestamp >= now() - INTERVAL 2 MONTH
  AND timestamp <= now()
GROUP BY datetime
ORDER BY datetime
```

## Processor Queries

### getTeams (PostgreSQL)

```sql
SELECT id
FROM teams
```

### getAppsForTeam (PostgreSQL)

```sql
SELECT id, team_id
FROM apps
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
```

### getLastReportedAt (PostgreSQL)

```sql
SELECT metrics_reported_at
FROM network_metrics_reporting
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
```

### getLastPatternGeneratedAt (PostgreSQL)

```sql
SELECT pattern_generated_at
FROM network_metrics_reporting
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
```

### fetchHttpEvents

```sql
SELECT team_id, app_id, domain, path, count() as cnt
FROM http_events
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND timestamp >= '2026-02-16 00:00:00'
  AND timestamp < '2026-02-23 00:00:00'
  AND domain != ''
  AND path != ''
GROUP BY team_id, app_id, domain, path
```

### insertAggregatedMetrics — Delete existing

```sql
DELETE FROM http_metrics
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND timestamp >= '2026-02-16 00:00:00'
  AND timestamp < '2026-02-23 00:00:00'
```

### insertAggregatedMetrics — INSERT...SELECT

```sql
INSERT INTO http_metrics
SELECT
    e.team_id,
    e.app_id,
    toStartOfFifteenMinutes(e.timestamp) AS ts,
    e.protocol,
    e.port,
    e.domain,
    p.path AS path,
    e.method,
    e.status_code,
    e.app_version,
    e.os_version,
    e.device_manufacturer,
    e.device_name,
    groupUniqArray(e.network_provider),
    groupUniqArray(e.network_type),
    groupUniqArray(e.network_generation),
    groupUniqArray(e.device_locale),
    toUInt64(count()),
    toUInt64(countIf(status_code >= 200 AND status_code < 300)),
    toUInt64(countIf(status_code >= 300 AND status_code < 400)),
    toUInt64(countIf(status_code >= 400 AND status_code < 500)),
    toUInt64(countIf(status_code >= 500 AND status_code < 600)),
    quantilesState(0.5, 0.75, 0.90, 0.95, 0.99, 1.0)(e.latency_ms)
FROM http_events e
JOIN (
    SELECT DISTINCT domain, path
    FROM url_patterns FINAL
    WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
      AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
) p ON e.domain = p.domain AND multiIf(
    endsWith(p.path, '**') AND position(substring(p.path, 1, length(p.path) - 2), '*') = 0,
        startsWith(e.path, substring(p.path, 1, length(p.path) - 2)),
    position(p.path, '*') > 0,
        e.path LIKE replaceAll(p.path, '*', '%'),
    e.path = p.path
)
WHERE e.team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND e.app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND e.timestamp >= '2026-02-16 00:00:00'
  AND e.timestamp < '2026-02-23 00:00:00'
  AND e.latency_ms <= 60000
  AND e.status_code != 0
  AND e.domain != ''
  AND e.path != ''
GROUP BY e.team_id, e.app_id, ts, e.protocol, e.port, e.domain, p.path,
         e.method, e.status_code, e.app_version, e.os_version,
         e.device_manufacturer, e.device_name
```

### Insert url_patterns

```sql
INSERT INTO url_patterns (team_id, app_id, domain, path, last_accessed_at)
VALUES
    ('b31b7648-7a15-4c52-85e0-2748d0cb1911', 'cbfe4099-4591-4759-b615-8c038e98afd3', 'api.measure.sh', '/api/users/*', now()),
    ('b31b7648-7a15-4c52-85e0-2748d0cb1911', 'cbfe4099-4591-4759-b615-8c038e98afd3', 'api.measure.sh', '/api/events/**', now())
```

### upsertReportedAt (PostgreSQL)

```sql
INSERT INTO network_metrics_reporting (team_id, app_id, metrics_reported_at)
VALUES ('b31b7648-7a15-4c52-85e0-2748d0cb1911', 'cbfe4099-4591-4759-b615-8c038e98afd3', now())
ON CONFLICT (team_id, app_id) DO UPDATE SET metrics_reported_at = EXCLUDED.metrics_reported_at
```

### upsertPatternGeneratedAt (PostgreSQL)

```sql
INSERT INTO network_metrics_reporting (team_id, app_id, pattern_generated_at)
VALUES ('b31b7648-7a15-4c52-85e0-2748d0cb1911', 'cbfe4099-4591-4759-b615-8c038e98afd3', now())
ON CONFLICT (team_id, app_id) DO UPDATE SET pattern_generated_at = EXCLUDED.pattern_generated_at
```
