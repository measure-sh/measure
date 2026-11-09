package measure

import (
	"context"
	"strconv"
	"time"

	"backend/libs/chquery"
	"backend/libs/filter"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
)

// Journeys and funnels read a sample of the analytics_events table. ClickHouse
// estimates the rows in the query's range and picks the share of the app's
// installations that gives about the sample's row count, or every
// installation when the range has fewer rows. A query multiplies its counts
// by the number of installations that one installation in the sample
// represents.
const (
	// analyticsMaxSeconds is the maximum run time of one analytics query.
	analyticsMaxSeconds = 60
	// The maximum server memory for one funnel or journey query. A query that
	// needs more memory fails. A journey collects the steps of each session
	// in arrays, so it uses more memory than a funnel for the same rows.
	funnelMaxMemoryBytes  = 1 << 30
	journeyMaxMemoryBytes = 2 << 30

	// The memory of a query grows with the rows in the sample. The
	// _sample_factor column of a row is the number of installations that one
	// installation in the sample represents.
	sampledAnalyticsEvents = "analytics_events sample 5000000"
)

// analyticsEventsSample gives the sample of analytics_events that a query on
// flt reads. For a sample of a row count, ClickHouse calculates the share of
// installations again for each query. If rows are added to the range between
// two queries, the second query reads a smaller share. The sample percent of
// flt makes the query read the same share as the query that gave the percent.
func analyticsEventsSample(flt *filter.Filter) string {
	if flt.SamplePercent > 0 {
		return "analytics_events sample " + strconv.FormatFloat(flt.SamplePercent/100, 'f', -1, 64)
	}
	return sampledAnalyticsEvents
}

// analyticsDays gives a condition on the days from the "from" time to the "to"
// time. analytics_events is sorted by the day of timestamp, and ClickHouse
// skips the rows of other days only for a condition on toDate(timestamp), not
// for one on timestamp. Without this condition, a query reads all the rows of
// the app in the months of the range, and a sampled query reads a smaller share
// of the installations than the range needs.
func analyticsDays(column string, from, to time.Time) (string, any, any) {
	return "toDate(" + column + ") between ? and ?", from.UTC().Format(time.DateOnly), to.UTC().Format(time.DateOnly)
}

// analyticsCtx sets the team of the query and the limits of time and memory.
func analyticsCtx(ctx context.Context, teamID uuid.UUID, maxMemoryBytes int) context.Context {
	ctx = chquery.WithTeamScope(ctx, teamID)
	return chquery.WithSettings(ctx, clickhouse.Settings{
		"max_execution_time": analyticsMaxSeconds,
		"max_memory_usage":   maxMemoryBytes,
	})
}

// samplePercent gives the percent of the app's installations that a sampled
// query read, from the _sample_factor of its rows. A query that found no rows
// has a factor of 0. Then the percent is unknown, and nil, since a small
// sample can miss rows that exist.
func samplePercent(factor float64) *float64 {
	if factor == 0 {
		return nil
	}
	percent := 100 / factor
	return &percent
}
