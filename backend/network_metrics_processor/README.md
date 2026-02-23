# Network Metrics Processor

Two scheduled jobs that discover URL patterns from raw HTTP traffic and pre-aggregate metrics for fast querying.

## Jobs

### GeneratePatterns — daily at 00:00 UTC

Discovers URL patterns from `http_events` and writes them to `url_patterns`.

1. For each (team, app), fetches raw paths from `http_events` since the last run (first run lookback: 7 days)
2. Normalizes dynamic segments (UUIDs, SHA-1/MD5 hashes, dates, hex values, 2+ digit integers) to `*`
3. Builds a single trie per app with domain as root segment and consolidates via eager collapsing
4. Stores patterns with >= 100 occurrences in the `url_patterns` ClickHouse table

### GenerateMetrics — hourly

Pre-aggregates metrics from `http_events` into 15-minute buckets in the `http_metrics` table.

1. For each (team, app), reads events since the last run (first run lookback: 3 hours)
2. Joins `http_events` with `url_patterns` using path matching (exact, wildcard via LIKE, or prefix via `startsWith`)
3. Groups by timestamp bucket, domain, path, method, status code, app/os version, and device info
4. Computes request counts, status code distribution (2xx–5xx), and latency percentiles (p50–p99)

## Trie collapsing

- Paths are split by `/` and inserted into a trie with domain as the root segment
- A node collapses when an 11th child would be added (depth > 1 only)
- Collapsing removes all descendants, sums their counts, and absorbs future inserts
- Depth 0 (domain) and depth 1 (first path segment) nodes never collapse
- Collapsed nodes produce patterns ending in `**`; leaf nodes produce exact patterns
