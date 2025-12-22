package logcomment

import (
	"context"

	"github.com/ClickHouse/clickhouse-go/v2"
)

// WithSettingsPut puts the key & value in the logcomment, updates settings
// and returns a usable context.
func WithSettingsPut(ctx context.Context, settings clickhouse.Settings, lc *Fields, key, val string) context.Context {
	settings["log_comment"] = lc.MustPut(key, val).String()
	return clickhouse.Context(ctx, clickhouse.WithSettings(settings))
}
