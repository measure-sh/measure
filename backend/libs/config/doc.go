// Package config provides constants for table names and query cache TTLs
// in the measure backend API.
//
// This package centralizes these values to avoid magic strings, ensure consistency,
// and simplify refactoring across the codebase.
//
// # Usage
//
// Import the package:
//
//	import "measure/backend/api/config"
//
// Use in queries or cache setups:
//
//	table := config.AppFiltersTable
//	ttl := config.DefaultQueryCacheTTL
//
// # Exported Constants
//
// - DefaultQueryCacheTTL: Default TTL for query caches (10 minutes).
// - AppFiltersTable: "app_filters final".
// - SpanFiltersTable: "span_filters final".
//
// # Notes
//
// These constants are immutable and goroutine-safe by design.
//
// Run `go doc config` locally to view rendered documentation.
package config
