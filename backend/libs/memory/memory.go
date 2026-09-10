// Package memory computes the Memory Monitoring tab's two views: a
// percentile trend over time (raw events, one row per periodic reading) and
// a ranking of sessions by their own peak usage (the sessions rollup, one
// row per session). See network.GetLatencyPlot and network.FetchTrends,
// which this package's two query shapes are modeled on.
package memory

import (
	"context"
	"math"
	"time"

	"backend/libs/chquery"
	"backend/libs/exprfilter"
	"backend/libs/logcomment"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// UsageDataPoint is one time bucket of the memory usage trend.
type UsageDataPoint map[string]any

const (
	eventTypeDynamic  = "memory_usage_dynamic"
	eventTypeAbsolute = "memory_usage_absolute"
)

// Scope narrows the trend to foreground-only or background-only readings.
// Android only — iOS collection is foreground-only already, so it has no
// background reading to narrow away.
type Scope string

const (
	ScopeAny        Scope = ""
	ScopeForeground Scope = "foreground"
	ScopeBackground Scope = "background"
)

// withQueryName tags a query with its name for the ClickHouse query log.
func withQueryName(ctx context.Context, name string) context.Context {
	lc := logcomment.New(2)
	settings := clickhouse.Settings{
		"log_comment": lc.MustPut(logcomment.Root, logcomment.Memory).String(),
	}
	return chquery.WithSettings(ctx, logcomment.Put(settings, lc, logcomment.Name, name))
}

// GetUsagePlot returns p50/p90/p95 of dynamic memory usage (Android,
// anon_rss + swap) or memory footprint (iOS, used_memory) over time.
func GetUsagePlot(
	ctx context.Context,
	ch driver.Conn,
	appId, teamId uuid.UUID,
	ios bool,
	scope Scope,
	ef *exprfilter.ExprFilter,
	bucketExpr, datetimeFormat string,
) ([]UsageDataPoint, error) {
	ctx = chquery.WithTeamScope(ctx, teamId)

	result := make([]UsageDataPoint, 0)

	valueExpr := "memory_usage_dynamic.anon_rss + coalesce(memory_usage_dynamic.swap, 0)"
	eventType := eventTypeDynamic
	if ios {
		valueExpr = "memory_usage_absolute.used_memory"
		eventType = eventTypeAbsolute
	}

	stmt := sqlf.From("events").
		Select(bucketExpr+" as datetime_bucket", ef.Timezone).
		Select("formatDateTime(datetime_bucket, ?) as datetime", datetimeFormat).
		Select("quantiles(0.50, 0.90, 0.95)("+valueExpr+") as usage").
		Select("uniqCombined64(session_id) as sessions").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", appId).
		Where("type = ?", eventType).
		Where("timestamp >= ?", ef.From).
		Where("timestamp < ?", ef.To)

	if !ios {
		// a memory_usage_dynamic row with a null anon_rss carried no usable
		// reading (proc/self/status was unavailable) and must not enter the
		// percentile computation.
		stmt.Where("memory_usage_dynamic.anon_rss is not null")
		switch scope {
		case ScopeForeground:
			stmt.Where("memory_usage_dynamic.foreground = true")
		case ScopeBackground:
			stmt.Where("memory_usage_dynamic.foreground = false")
		}
	}

	defer stmt.Close()

	if ef.HasFilterExpr() {
		predicate, err := ef.Predicate(nil)
		if err != nil {
			return nil, err
		}
		defer predicate.Close()
		stmt.Where(predicate.String(), predicate.Args()...)
	}

	stmt.GroupBy("datetime_bucket").OrderBy("datetime_bucket")

	ctx = withQueryName(ctx, "usage_plot")

	rows, err := ch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}

	for rows.Next() {
		var db time.Time
		var dt string
		var usage []float64
		var sessions uint64
		if err = rows.Scan(&db, &dt, &usage, &sessions); err != nil {
			return nil, err
		}
		data := UsageDataPoint{"datetime": dt, "count": sessions}
		if len(usage) >= 3 {
			data["p50"] = math.Round(usage[0])
			data["p90"] = math.Round(usage[1])
			data["p95"] = math.Round(usage[2])
		}
		result = append(result, data)
	}

	return result, nil
}
