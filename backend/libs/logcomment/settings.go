package logcomment

import (
	"github.com/ClickHouse/clickhouse-go/v2"
)

// Put sets the computed log_comment on settings & returns settings. It only
// mutates the map, no context wrap, so it composes with chquery.WithSettings.
func Put(settings clickhouse.Settings, lc *Fields, key, val string) clickhouse.Settings {
	if settings == nil {
		settings = clickhouse.Settings{}
	}
	settings["log_comment"] = lc.MustPut(key, val).String()
	return settings
}
