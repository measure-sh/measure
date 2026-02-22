# Network Queries

All queries target ClickHouse. Date range: last 2 months.

```
app_id:  cbfe4099-4591-4759-b615-8c038e98afd3
team_id: b31b7648-7a15-4c52-85e0-2748d0cb1911
```

## FetchDomains

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

### Primary: url_patterns

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

### Fallback: http_events

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

## patternExists

```sql
SELECT 1
FROM url_patterns FINAL
WHERE team_id = 'b31b7648-7a15-4c52-85e0-2748d0cb1911'
  AND app_id = 'cbfe4099-4591-4759-b615-8c038e98afd3'
  AND domain = 'api.measure.sh'
  AND path = '/api/users/*'
LIMIT 1
```

## FetchTrends

```sql
WITH grouped AS (
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

## GetRequestStatusOverview

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
