package config

import "time"

// DefaultQueryCacheTTL is the default query cache
// TTL duration.
const DefaultQueryCacheTTL = time.Minute * 10

// AppFiltersTable is the name of the table for event filters.
const AppFiltersTable = "app_filters final"

// SpanFiltersTable is the name of the table for span
// filters.
const SpanFiltersTable = "span_filters final"

// AppMetricsTable is the name of the table for app's
// metrics.
const AppMetricsTable = "app_metrics final"

// EventsTable is the name of the table for app's
// raw events.
const EventsTable = "events"

// FatalExceptionExpr is the SQL predicate for a fatal exception on the events
// table. Bridges legacy rows written before the severity column, where only
// the deprecated handled flag expressed fatality. Must be paired with a
// type = 'exception' gate: non-exception rows carry empty severity &
// handled=false, so they satisfy it on their own.
const FatalExceptionExpr = "(`exception.severity` = 'fatal' OR (`exception.severity` = '' AND `exception.handled` = false))"
