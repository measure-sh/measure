# URL Processor

Discovers URL patterns from raw HTTP traffic and stores them in the `url_patterns` ClickHouse table. Runs as a cron job every minute.

## What it does

1. Fetches raw paths from `http_events` for the last month, grouped by team, app, and domain
2. Normalizes dynamic path segments (UUIDs, hashes, dates, hex values, integers) to `*`
3. Consolidates similar paths using a trie with eager collapsing
4. Stores the top 10 patterns per (team, app, domain) in `url_patterns`

## How collapsing works

- Each unique path is inserted into a trie, split by `/` segments
- A trie node is allowed at most 2 children
- When a 3rd child would be added, the node collapses: all its descendants are removed and their counts are summed into the collapsed node
- Once collapsed, a node absorbs all future inserts that pass through it
- The root node never collapses, so top-level path segments (e.g., `/api`, `/web`, `/static`) are always preserved
- The result is a compact set of patterns where high-variance path branches are replaced with wildcards
