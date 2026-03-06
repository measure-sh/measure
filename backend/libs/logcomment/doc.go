// Package logcomment provides utilities for constructing, parsing, and applying
// structured log comments to ClickHouse queries.
//
// A log comment is a space-separated sequence of `key=value` pairs injected into
// queries via the `log_comment` ClickHouse setting. This package validates keys
// (must match `[A-Za-z0-9_]+`) and values (must not contain spaces or `=`),
// serializes them efficiently—designed with performance in mind (minimal allocations using strings.Builder in String/StringSorted, pre-allocated capacities in New, low-overhead parsing in Parse)—and integrates with ClickHouse contexts.
//
// ## Fields
//
// The core type is `Fields`, a map-backed collection of key-value pairs.
//
// Its methods like `New`, `String`, `StringSorted`, and `Parse` are specifically designed for high performance with minimal allocations, efficient strings.Builder usage, and pre-allocated capacities.
//
// Key methods:
//   - `New(capacity int) *Fields` – create with pre-allocated capacity.
//   - `Put(key, value string) error` – add/overwrite with validation.
//   - `MustPut(key, value string) *Fields` – panics on error.
//   - `Get(key string) (string, bool)` – retrieve value.
//   - `String() string` – serialize (unsorted, fastest).
//   - `StringSorted() string` – serialize with sorted keys (stable).
//   - `Parse(s string, capacity int) (*Fields, error)` – parse minimal-allocation.
//
// ## Predefined Keys
//
// Common logcomment keys are provided as constants:
//   - `Root = "root"`
//   - `Name = "name"`
//   - `Crashes = "crashes"`
//   - `Sessions = "sessions"`
//   - `ANRs = "anrs"`
//   - `Filters = "filters"`
//   - `Metrics = "metrics"`
//   - `Journeys = "journeys"`
//
// ## ClickHouse Integration
//
// `WithSettingsPut` appends a key-value pair to existing `Fields`, updates the
// `settings["log_comment"]`, and returns a ClickHouse context:
//
//	ctx := logcomment.WithSettingsPut(ctx, settings, f, "user_id", "123")
//
// ## Examples
//
// ### Building Fields
//
// ```go
// f := logcomment.New(4)
// f.MustPut(logcomment.Name, "sessions")
// f.MustPut(logcomment.Root, "myproject")
// lc := f.String()  // e.g., "name=sessions root=myproject"
// ```
//
// ### Parsing Fields
//
// ```go
// f, err := logcomment.Parse("name=query1 root=proj filters=foo", 4)
// if err != nil { /* handle */ }
// ```
//
// ### Applying to ClickHouse
//
// ```go
// import (
//
//	"context"
//	"github.com/ClickHouse/clickhouse-go/v2"
//
// )
//
// f := logcomment.New(2)
// f.MustPut(logcomment.Name, "daily-active")
//
// settings := clickhouse.Settings{}
// ctx := logcomment.WithSettingsPut(context.Background(), settings, f, "env", "prod")
//
// /* use ctx with conn.Exec(ctx, ch.Query(...)) */
//
// fmt.Println(settings["log_comment"])  // "name=daily-active env=prod"
// ```
package logcomment
