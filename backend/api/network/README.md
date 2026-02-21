# Network Queries

All queries target ClickHouse. Replace date range as needed.

```
app_id:  cbfe4099-4591-4759-b615-8c038e98afd3
team_id: b31b7648-7a15-4c52-85e0-2748d0cb1911
```

## FetchDomains

Returns unique domains ordered by request frequency.

```sql
SELECT domain
FROM http_events
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain != ''
GROUP BY domain
ORDER BY count() DESC
```

## FetchPaths

Returns unique paths for a domain. Queries `url_patterns` first, falls back to `http_events` if none found.

### Primary: url_patterns

```sql
SELECT path
FROM url_patterns FINAL
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.example.com'
  AND positionCaseInsensitive(path, 'health') > 0
ORDER BY path
LIMIT 10
```

### Events fallback (when no url_patterns exist)

```sql
SELECT path
FROM http_events
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.example.com'
  AND positionCaseInsensitive(path, 'health') > 0
GROUP BY path
ORDER BY count() DESC
LIMIT 10
```

## FetchTrends

Returns top endpoints by latency, error rate, and frequency. Cross-joins `url_patterns` with `http_events` to compute metrics at query time.

```sql
WITH grouped AS (
    SELECT
        e.domain,
        p.path AS path_pattern,
        quantiles(0.50, 0.90, 0.95, 0.99)(e.latency_ms)[3] AS p95_latency,
        countIf(e.status_code >= 400 AND e.status_code < 600) * 100.0 / count() AS error_rate,
        count() AS frequency
    FROM http_events e,
        (SELECT DISTINCT domain, path FROM url_patterns FINAL
         WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
           AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3') p
    WHERE e.team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
      AND e.app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
      AND e.timestamp >= '2026-01-01 00:00:00'
      AND e.timestamp <= '2026-02-20 23:59:59'
      AND e.latency_ms <= 60000
      AND e.domain = p.domain
      AND multiIf(
          endsWith(p.path, '**') AND position(substring(p.path, 1, length(p.path) - 2), '*') = 0,
              startsWith(e.path, substring(p.path, 1, length(p.path) - 2)),
          position(p.path, '*') > 0,
              e.path LIKE replaceAll(p.path, '*', '%'),
          e.path = p.path
      )
    GROUP BY e.domain, p.path
)
SELECT 'latency' as category, domain, path_pattern, p95_latency, error_rate, frequency
FROM grouped ORDER BY p95_latency DESC LIMIT 100
UNION ALL
SELECT 'error_rate' as category, domain, path_pattern, p95_latency, error_rate, frequency
FROM grouped ORDER BY error_rate DESC LIMIT 100
UNION ALL
SELECT 'frequency' as category, domain, path_pattern, p95_latency, error_rate, frequency
FROM grouped ORDER BY frequency DESC LIMIT 100
```

## FetchMetrics

Returns latency percentiles and status code distribution for a specific domain + path pattern. Delegates to `fetchMetricsFromEvents`.

### Latency query

```sql
SELECT
    formatDateTime(timestamp, '%Y-%m-%d', 'UTC') as datetime,
    quantiles(0.50, 0.90, 0.95, 0.99)(latency_ms) as latencies,
    countIf(status_code >= 200 and status_code < 600) as count
FROM http_events
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.example.com'
  AND timestamp >= '2025-01-01 00:00:00'
  AND timestamp <= '2025-12-31 23:59:59'
  AND latency_ms <= 60000
  AND path LIKE '/api/users/%'  -- applyPathFilter: * -> %, ** -> startsWith
GROUP BY datetime
ORDER BY datetime
```

### Status codes query

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
  AND domain = 'api.example.com'
  AND timestamp >= '2025-01-01 00:00:00'
  AND timestamp <= '2025-12-31 23:59:59'
  AND status_code != 0
  AND latency_ms <= 60000
  AND path LIKE '/api/users/%'
GROUP BY datetime
ORDER BY datetime
```

## GetRequestStatusOverview

Returns daily status code distribution across all endpoints for an app.

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
  AND timestamp >= '2025-01-01 00:00:00'
  AND timestamp <= '2025-12-31 23:59:59'
GROUP BY datetime
ORDER BY datetime
```
