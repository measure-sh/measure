package config

import "time"

// DefaultQueryCacheTTL is the default query cache
// TTL duration.
const DefaultQueryCacheTTL = time.Minute * 10

// AppFiltersTable is the name of the table for event filters.
const AppFiltersTable = "app_filters"

// SpanFiltersTable is the name of the table for span
// filters.
const SpanFiltersTable = "span_filters"

// AppMetricsTable is the name of the table for app's
// metrics.
const AppMetricsTable = "app_metrics final"

// EventsTable is the name of the table for app's
// raw events.
const EventsTable = "events"
