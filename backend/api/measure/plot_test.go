//go:build integration

package measure

import (
	"backend/api/event"
	"backend/api/filter"
	"backend/api/server"
	"backend/api/session"
	"backend/api/span"
	"context"
	"math"
	"testing"
	"time"

	"github.com/google/uuid"
)

type plotCase struct {
	name       string
	group      string
	timestamps []time.Time
}

type plotFixture struct {
	ctx    context.Context
	teamID uuid.UUID
	appID  uuid.UUID
	app    App
}

func newPlotFixture(t *testing.T) plotFixture {
	t.Helper()

	ctx := context.Background()
	server.Server.ChPool = th.ChConn
	cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	return plotFixture{
		ctx:    ctx,
		teamID: teamID,
		appID:  appID,
		app:    App{ID: &appID, TeamId: teamID},
	}
}

func (f plotFixture) appFilter(from, to time.Time, timezone, plotTimeGroup string) *filter.AppFilter {
	af := &filter.AppFilter{
		AppID:    f.appID,
		From:     from,
		To:       to,
		Timezone: timezone,
		Limit:    filter.DefaultPaginationLimit,
	}
	if plotTimeGroup != "" {
		af.PlotTimeGroup = plotTimeGroup
	}
	return af
}

func (f plotFixture) teamIDStr() string { return f.teamID.String() }
func (f plotFixture) appIDStr() string  { return f.appID.String() }

func requireSingleDateBucket[T any](t *testing.T, items []T, gotDate, expectedDate, source string) {
	t.Helper()
	if len(items) != 1 {
		t.Fatalf("expected 1 row for %s, got %d", source, len(items))
	}
	if gotDate != expectedDate {
		t.Fatalf("expected timezone-shifted day bucket %s, got %q", expectedDate, gotDate)
	}
}

// --------------------------------------------------------------------------
// Grouping behavior
// --------------------------------------------------------------------------

func TestPlotMethodsGroupByPlotTimeGroup(t *testing.T) {
	f := newPlotFixture(t)

	groups := []plotCase{
		{
			name:  "minutes",
			group: filter.PlotTimeGroupMinutes,
			timestamps: []time.Time{
				time.Date(2026, 1, 5, 10, 15, 10, 0, time.UTC),
				time.Date(2026, 1, 5, 10, 15, 40, 0, time.UTC),
				time.Date(2026, 1, 5, 10, 16, 5, 0, time.UTC),
			},
		},
		{
			name:  "hours",
			group: filter.PlotTimeGroupHours,
			timestamps: []time.Time{
				time.Date(2026, 1, 5, 10, 5, 0, 0, time.UTC),
				time.Date(2026, 1, 5, 10, 45, 0, 0, time.UTC),
				time.Date(2026, 1, 5, 11, 2, 0, 0, time.UTC),
			},
		},
		{
			name:  "days",
			group: filter.PlotTimeGroupDays,
			timestamps: []time.Time{
				time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC),
				time.Date(2026, 1, 5, 22, 0, 0, 0, time.UTC),
				time.Date(2026, 1, 6, 1, 0, 0, 0, time.UTC),
			},
		},
		{
			name:  "months",
			group: filter.PlotTimeGroupMonths,
			timestamps: []time.Time{
				time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC),
				time.Date(2026, 1, 20, 22, 0, 0, 0, time.UTC),
				time.Date(2026, 2, 1, 1, 0, 0, 0, time.UTC),
			},
		},
	}

	for _, tc := range groups {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			cleanupAll(f.ctx, t)

			from := tc.timestamps[0].Add(-time.Hour)
			to := tc.timestamps[len(tc.timestamps)-1].Add(time.Hour)
			af := f.appFilter(from, to, "UTC", tc.group)

			t.Run("exception_group_plot", func(t *testing.T) {
				fingerprint := "12345678901234567890123456789012"
				for _, ts := range tc.timestamps {
					seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", fingerprint, false, ts)
				}

				items, err := f.app.GetExceptionGroupPlotInstances(f.ctx, fingerprint, af)
				if err != nil {
					t.Fatalf("GetExceptionGroupPlotInstances: %v", err)
				}

				assertIssueBuckets(t, items, expectedCounts(tc.timestamps, tc.group, false))
			})

			t.Run("exception_plot", func(t *testing.T) {
				cleanupAll(f.ctx, t)
				for _, ts := range tc.timestamps {
					seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", "", false, ts)
				}

				items, err := f.app.GetExceptionPlotInstances(f.ctx, af)
				if err != nil {
					t.Fatalf("GetExceptionPlotInstances: %v", err)
				}

				assertIssueBuckets(t, items, expectedCounts(tc.timestamps, tc.group, false))
			})

			t.Run("anr_group_plot", func(t *testing.T) {
				cleanupAll(f.ctx, t)
				fingerprint := "abcdefabcdefabcdefabcdefabcdefab"
				for _, ts := range tc.timestamps {
					seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "anr", fingerprint, false, ts)
				}

				items, err := f.app.GetANRGroupPlotInstances(f.ctx, fingerprint, af)
				if err != nil {
					t.Fatalf("GetANRGroupPlotInstances: %v", err)
				}

				assertIssueBuckets(t, items, expectedCounts(tc.timestamps, tc.group, false))
			})

			t.Run("anr_plot", func(t *testing.T) {
				cleanupAll(f.ctx, t)
				for _, ts := range tc.timestamps {
					seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "anr", "", false, ts)
				}

				items, err := f.app.GetANRPlotInstances(f.ctx, af)
				if err != nil {
					t.Fatalf("GetANRPlotInstances: %v", err)
				}

				assertIssueBuckets(t, items, expectedCounts(tc.timestamps, tc.group, false))
			})

			t.Run("sessions_plot", func(t *testing.T) {
				cleanupAll(f.ctx, t)
				seedGenericEvents(f.ctx, t, f.teamIDStr(), f.appIDStr(), 2, tc.timestamps[0])
				seedGenericEvents(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, tc.timestamps[2])

				items, err := f.app.GetSessionsInstancesPlot(f.ctx, af)
				if err != nil {
					t.Fatalf("GetSessionsInstancesPlot: %v", err)
				}

				assertSessionBuckets(t, items, expectedCounts([]time.Time{tc.timestamps[0], tc.timestamps[0], tc.timestamps[2]}, tc.group, false))
			})

			t.Run("span_metrics_plot", func(t *testing.T) {
				cleanupAll(f.ctx, t)

				spanTimes := spanMetricTimesForGroup(tc.group)
				afSpan := f.appFilter(spanTimes[0].Add(-time.Hour), spanTimes[len(spanTimes)-1].Add(time.Hour), "UTC", tc.group)
				for _, ts := range spanTimes {
					seedSpan(
						f.ctx, t, f.teamIDStr(), f.appIDStr(),
						"http_request", 1,
						ts, ts.Add(750*time.Millisecond),
						"v1", "1",
					)
				}

				items, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, "http_request", afSpan)
				if err != nil {
					t.Fatalf("GetMetricsPlotForSpanNameWithFilter: %v", err)
				}

				assertSpanBuckets(t, items, expectedUniqueBuckets(spanTimes, tc.group, true))
			})

			t.Run("bug_report_plot", func(t *testing.T) {
				cleanupAll(f.ctx, t)
				for _, ts := range tc.timestamps {
					seedBugReport(f.ctx, t, f.teamIDStr(), f.appIDStr(), uuid.New().String(), "test report", ts)
				}

				items, err := f.app.GetBugReportInstancesPlot(f.ctx, af)
				if err != nil {
					t.Fatalf("GetBugReportInstancesPlot: %v", err)
				}

				assertBugReportBuckets(t, items, expectedCounts(tc.timestamps, tc.group, false))
			})
		})
	}
}

// --------------------------------------------------------------------------
// Default behavior when plot_time_group is omitted
// --------------------------------------------------------------------------

func TestExceptionPlotDefaultsToDaysWhenPlotTimeGroupMissing(t *testing.T) {
	f := newPlotFixture(t)

	t1 := time.Date(2026, 1, 5, 10, 15, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 5, 22, 15, 0, 0, time.UTC)
	t3 := time.Date(2026, 1, 6, 1, 15, 0, 0, time.UTC)
	for _, ts := range []time.Time{t1, t2, t3} {
		seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", "", false, ts)
	}

	af := f.appFilter(t1.Add(-time.Hour), t3.Add(time.Hour), "UTC", "")

	items, err := f.app.GetExceptionPlotInstances(f.ctx, af)
	if err != nil {
		t.Fatalf("GetExceptionPlotInstances: %v", err)
	}

	assertIssueBuckets(t, items, expectedCounts([]time.Time{t1, t2, t3}, filter.PlotTimeGroupDays, false))
}

func TestPlotMethodsValidationAndEmptyResults(t *testing.T) {
	f := newPlotFixture(t)
	now := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	t.Run("missing timezone returns error", func(t *testing.T) {
		af := f.appFilter(now.Add(-time.Hour), now.Add(time.Hour), "", filter.PlotTimeGroupDays)

		if _, err := f.app.GetExceptionPlotInstances(f.ctx, af); err == nil {
			t.Fatalf("expected error for missing timezone in exception plot")
		}
		if _, err := f.app.GetExceptionGroupPlotInstances(f.ctx, "12345678901234567890123456789012", af); err == nil {
			t.Fatalf("expected error for missing timezone in exception group plot")
		}
		if _, err := f.app.GetANRPlotInstances(f.ctx, af); err == nil {
			t.Fatalf("expected error for missing timezone in anr plot")
		}
		if _, err := f.app.GetANRGroupPlotInstances(f.ctx, "abcdefabcdefabcdefabcdefabcdefab", af); err == nil {
			t.Fatalf("expected error for missing timezone in anr group plot")
		}
		if _, err := f.app.GetSessionsInstancesPlot(f.ctx, af); err == nil {
			t.Fatalf("expected error for missing timezone in sessions plot")
		}
		if _, err := f.app.GetBugReportInstancesPlot(f.ctx, af); err == nil {
			t.Fatalf("expected error for missing timezone in bug report plot")
		}
		if _, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, "http_request", af); err == nil {
			t.Fatalf("expected error for missing timezone in span metrics plot")
		}
	})

	t.Run("unsupported plot_time_group returns error", func(t *testing.T) {
		af := f.appFilter(now.Add(-time.Hour), now.Add(time.Hour), "UTC", "weeks")
		if _, err := f.app.GetExceptionPlotInstances(f.ctx, af); err == nil {
			t.Fatalf("expected error for unsupported plot_time_group")
		}
		if _, err := f.app.GetExceptionGroupPlotInstances(f.ctx, "12345678901234567890123456789012", af); err == nil {
			t.Fatalf("expected error for unsupported plot_time_group in exception group plot")
		}
		if _, err := f.app.GetANRPlotInstances(f.ctx, af); err == nil {
			t.Fatalf("expected error for unsupported plot_time_group in anr plot")
		}
		if _, err := f.app.GetANRGroupPlotInstances(f.ctx, "abcdefabcdefabcdefabcdefabcdefab", af); err == nil {
			t.Fatalf("expected error for unsupported plot_time_group in anr group plot")
		}
		if _, err := f.app.GetSessionsInstancesPlot(f.ctx, af); err == nil {
			t.Fatalf("expected error for unsupported plot_time_group in sessions plot")
		}
		if _, err := f.app.GetBugReportInstancesPlot(f.ctx, af); err == nil {
			t.Fatalf("expected error for unsupported plot_time_group in bug report plot")
		}
		if _, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, "http_request", af); err == nil {
			t.Fatalf("expected error for unsupported plot_time_group in span metrics plot")
		}
	})

	t.Run("returns empty results when no matching data", func(t *testing.T) {
		af := f.appFilter(now.Add(-time.Hour), now.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)

		ex, err := f.app.GetExceptionPlotInstances(f.ctx, af)
		if err != nil {
			t.Fatalf("GetExceptionPlotInstances: %v", err)
		}
		if len(ex) != 0 {
			t.Fatalf("expected empty exception plot, got %d rows", len(ex))
		}

		anr, err := f.app.GetANRPlotInstances(f.ctx, af)
		if err != nil {
			t.Fatalf("GetANRPlotInstances: %v", err)
		}
		if len(anr) != 0 {
			t.Fatalf("expected empty anr plot, got %d rows", len(anr))
		}

		sessions, err := f.app.GetSessionsInstancesPlot(f.ctx, af)
		if err != nil {
			t.Fatalf("GetSessionsInstancesPlot: %v", err)
		}
		if len(sessions) != 0 {
			t.Fatalf("expected empty sessions plot, got %d rows", len(sessions))
		}

		spans, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, "http_request", af)
		if err != nil {
			t.Fatalf("GetMetricsPlotForSpanNameWithFilter: %v", err)
		}
		if len(spans) != 0 {
			t.Fatalf("expected empty spans plot, got %d rows", len(spans))
		}

		bugReports, err := f.app.GetBugReportInstancesPlot(f.ctx, af)
		if err != nil {
			t.Fatalf("GetBugReportInstancesPlot: %v", err)
		}
		if len(bugReports) != 0 {
			t.Fatalf("expected empty bug report plot, got %d rows", len(bugReports))
		}
	})
}

// --------------------------------------------------------------------------
// Timezone behavior
// --------------------------------------------------------------------------

func TestExceptionPlotRespectsTimezoneBucketing(t *testing.T) {
	f := newPlotFixture(t)

	// 2026-01-05T23:30Z becomes 2026-01-06 in Asia/Kolkata (+05:30).
	ts := time.Date(2026, 1, 5, 23, 30, 0, 0, time.UTC)
	seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", "", false, ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "Asia/Kolkata", filter.PlotTimeGroupDays)
	items, err := f.app.GetExceptionPlotInstances(f.ctx, af)
	if err != nil {
		t.Fatalf("GetExceptionPlotInstances: %v", err)
	}
	requireSingleDateBucket(t, items, items[0].DateTime, "2026-01-06", "exception plot")
}

func TestNonExceptionPlotsRespectTimezoneBucketing(t *testing.T) {
	f := newPlotFixture(t)

	// 2026-01-05T23:30Z becomes 2026-01-06 in Asia/Kolkata (+05:30).
	ts := time.Date(2026, 1, 5, 23, 30, 0, 0, time.UTC)

	t.Run("sessions", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedGenericEvents(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, ts)
		af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "Asia/Kolkata", filter.PlotTimeGroupDays)
		items, err := f.app.GetSessionsInstancesPlot(f.ctx, af)
		if err != nil {
			t.Fatalf("GetSessionsInstancesPlot: %v", err)
		}
		requireSingleDateBucket(t, items, items[0].DateTime, "2026-01-06", "sessions plot")
	})

	t.Run("span metrics", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedSpan(f.ctx, t, f.teamIDStr(), f.appIDStr(), "http_request", 1, ts, ts.Add(750*time.Millisecond), "v1", "1")
		af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "Asia/Kolkata", filter.PlotTimeGroupDays)
		items, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, "http_request", af)
		if err != nil {
			t.Fatalf("GetMetricsPlotForSpanNameWithFilter: %v", err)
		}
		requireSingleDateBucket(t, items, items[0].DateTime, "2026-01-06", "span metrics plot")
	})

	t.Run("bug reports", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedBugReport(f.ctx, t, f.teamIDStr(), f.appIDStr(), uuid.New().String(), "tz bug report", ts)
		af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "Asia/Kolkata", filter.PlotTimeGroupDays)
		items, err := f.app.GetBugReportInstancesPlot(f.ctx, af)
		if err != nil {
			t.Fatalf("GetBugReportInstancesPlot: %v", err)
		}
		requireSingleDateBucket(t, items, items[0].DateTime, "2026-01-06", "bug report plot")
	})
}

func TestPlotMethodsDefaultToDaysWhenPlotTimeGroupMissing(t *testing.T) {
	f := newPlotFixture(t)
	t1 := time.Date(2026, 1, 5, 10, 15, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 6, 1, 15, 0, 0, time.UTC)

	t.Run("exception group", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		fp := "12345678901234567890123456789012"
		seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", fp, false, t1)
		seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", fp, false, t2)
		af := f.appFilter(t1.Add(-time.Hour), t2.Add(time.Hour), "UTC", "")
		items, err := f.app.GetExceptionGroupPlotInstances(f.ctx, fp, af)
		if err != nil {
			t.Fatalf("GetExceptionGroupPlotInstances: %v", err)
		}
		assertIssueBuckets(t, items, expectedCounts([]time.Time{t1, t2}, filter.PlotTimeGroupDays, false))
	})

	t.Run("anr group", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		fp := "abcdefabcdefabcdefabcdefabcdefab"
		seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "anr", fp, false, t1)
		seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "anr", fp, false, t2)
		af := f.appFilter(t1.Add(-time.Hour), t2.Add(time.Hour), "UTC", "")
		items, err := f.app.GetANRGroupPlotInstances(f.ctx, fp, af)
		if err != nil {
			t.Fatalf("GetANRGroupPlotInstances: %v", err)
		}
		assertIssueBuckets(t, items, expectedCounts([]time.Time{t1, t2}, filter.PlotTimeGroupDays, false))
	})

	t.Run("anr overview", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "anr", "", false, t1)
		seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "anr", "", false, t2)
		af := f.appFilter(t1.Add(-time.Hour), t2.Add(time.Hour), "UTC", "")
		items, err := f.app.GetANRPlotInstances(f.ctx, af)
		if err != nil {
			t.Fatalf("GetANRPlotInstances: %v", err)
		}
		assertIssueBuckets(t, items, expectedCounts([]time.Time{t1, t2}, filter.PlotTimeGroupDays, false))
	})

	t.Run("sessions", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedGenericEvents(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, t1)
		seedGenericEvents(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, t2)
		af := f.appFilter(t1.Add(-time.Hour), t2.Add(time.Hour), "UTC", "")
		items, err := f.app.GetSessionsInstancesPlot(f.ctx, af)
		if err != nil {
			t.Fatalf("GetSessionsInstancesPlot: %v", err)
		}
		assertSessionBuckets(t, items, expectedCounts([]time.Time{t1, t2}, filter.PlotTimeGroupDays, false))
	})

	t.Run("span metrics", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedSpan(f.ctx, t, f.teamIDStr(), f.appIDStr(), "http_request", 1, t1, t1.Add(time.Second), "v1", "1")
		seedSpan(f.ctx, t, f.teamIDStr(), f.appIDStr(), "http_request", 1, t2, t2.Add(time.Second), "v1", "1")
		af := f.appFilter(t1.Add(-time.Hour), t2.Add(time.Hour), "UTC", "")
		items, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, "http_request", af)
		if err != nil {
			t.Fatalf("GetMetricsPlotForSpanNameWithFilter: %v", err)
		}
		assertSpanBuckets(t, items, expectedUniqueBuckets([]time.Time{t1, t2}, filter.PlotTimeGroupDays, true))
	})

	t.Run("bug reports", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedBugReport(f.ctx, t, f.teamIDStr(), f.appIDStr(), uuid.New().String(), "test report", t1)
		seedBugReport(f.ctx, t, f.teamIDStr(), f.appIDStr(), uuid.New().String(), "test report", t2)
		af := f.appFilter(t1.Add(-time.Hour), t2.Add(time.Hour), "UTC", "")
		items, err := f.app.GetBugReportInstancesPlot(f.ctx, af)
		if err != nil {
			t.Fatalf("GetBugReportInstancesPlot: %v", err)
		}
		assertBugReportBuckets(t, items, expectedCounts([]time.Time{t1, t2}, filter.PlotTimeGroupDays, false))
	})
}

// --------------------------------------------------------------------------
// Optional filter behavior
// --------------------------------------------------------------------------

func TestPlotMethodsRespectOptionalFilters(t *testing.T) {
	f := newPlotFixture(t)
	now := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	t.Run("exception versions filter", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", "", false, now)

		af := f.appFilter(now.Add(-time.Hour), now.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
		af.Versions = []string{"v1"}
		af.VersionCodes = []string{"1"}

		items, err := f.app.GetExceptionPlotInstances(f.ctx, af)
		if err != nil {
			t.Fatalf("GetExceptionPlotInstances: %v", err)
		}
		if len(items) == 0 {
			t.Fatalf("expected non-empty result for matching version filters")
		}

		af.VersionCodes = []string{"999"}
		items, err = f.app.GetExceptionPlotInstances(f.ctx, af)
		if err != nil {
			t.Fatalf("GetExceptionPlotInstances mismatch filter: %v", err)
		}
		if len(items) != 0 {
			t.Fatalf("expected empty result for non-matching version filters")
		}
	})

	t.Run("span status filter", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedSpan(f.ctx, t, f.teamIDStr(), f.appIDStr(), "http_request", 1, now, now.Add(time.Second), "v1", "1")

		af := f.appFilter(now.Add(-time.Hour), now.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
		af.SpanStatuses = []int8{1}
		items, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, "http_request", af)
		if err != nil {
			t.Fatalf("GetMetricsPlotForSpanNameWithFilter: %v", err)
		}
		if len(items) == 0 {
			t.Fatalf("expected non-empty span metrics for matching status")
		}

		af.SpanStatuses = []int8{2}
		items, err = f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, "http_request", af)
		if err != nil {
			t.Fatalf("GetMetricsPlotForSpanNameWithFilter mismatch status: %v", err)
		}
		if len(items) != 0 {
			t.Fatalf("expected empty span metrics for non-matching status")
		}
	})

	t.Run("bug report status filter", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedBugReport(f.ctx, t, f.teamIDStr(), f.appIDStr(), uuid.New().String(), "test report", now)

		af := f.appFilter(now.Add(-time.Hour), now.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
		af.BugReportStatuses = []int8{1}
		items, err := f.app.GetBugReportInstancesPlot(f.ctx, af)
		if err != nil {
			t.Fatalf("GetBugReportInstancesPlot: %v", err)
		}
		if len(items) == 0 {
			t.Fatalf("expected non-empty bug report plot for matching status")
		}

		af.BugReportStatuses = []int8{0}
		items, err = f.app.GetBugReportInstancesPlot(f.ctx, af)
		if err != nil {
			t.Fatalf("GetBugReportInstancesPlot mismatch status: %v", err)
		}
		if len(items) != 0 {
			t.Fatalf("expected empty bug report plot for non-matching status")
		}
	})
}

// --------------------------------------------------------------------------
// Span quantile aggregation behavior
// --------------------------------------------------------------------------

func TestSpanMetricsPlotQuantilesForUniformDurations(t *testing.T) {
	f := newPlotFixture(t)
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	// Same duration for all rows in one bucket/version should make all quantiles
	// collapse to the same value.
	for i := 0; i < 5; i++ {
		start := base.Add(time.Duration(i) * time.Minute)
		end := start.Add(3 * time.Second)
		seedSpan(f.ctx, t, f.teamIDStr(), f.appIDStr(), "http_request", 1, start, end, "v1", "1")
	}

	af := f.appFilter(base.Add(-time.Hour), base.Add(time.Hour), "UTC", filter.PlotTimeGroupHours)
	items, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, "http_request", af)
	if err != nil {
		t.Fatalf("GetMetricsPlotForSpanNameWithFilter: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 span-metrics row, got %d", len(items))
	}

	p50, p90, p95, p99 := spanQuantiles(t, items[0], "uniform-duration row")
	if p50 != p90 || p90 != p95 || p95 != p99 {
		t.Fatalf("expected equal quantiles for uniform durations, got p50=%.2f p90=%.2f p95=%.2f p99=%.2f", p50, p90, p95, p99)
	}
	// We use a small tolerance for quantile assertions because results are
	// produced through aggregate-state merges and floating-point math
	// (quantileMerge + round), where tiny representation differences can appear
	// across runs/engines even for deterministic inputs.
	assertApprox(t, p50, 3000.0, 0.01, "uniform p50")
	assertApprox(t, p90, 3000.0, 0.01, "uniform p90")
	assertApprox(t, p95, 3000.0, 0.01, "uniform p95")
	assertApprox(t, p99, 3000.0, 0.01, "uniform p99")
}

func TestSpanMetricsPlotQuantilesAreMonotonicAndVersionIsolated(t *testing.T) {
	f := newPlotFixture(t)
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	// Version v1 has lower uniform durations.
	for i := 0; i < 4; i++ {
		secs := 2
		start := base.Add(time.Duration(secs) * time.Minute)
		seedSpan(f.ctx, t, f.teamIDStr(), f.appIDStr(), "http_request", 1, start, start.Add(time.Duration(secs)*time.Second), "v1", "1")
	}
	// Version v2 has higher uniform durations.
	for i := 0; i < 4; i++ {
		secs := 8
		start := base.Add(time.Duration(secs) * time.Minute)
		seedSpan(f.ctx, t, f.teamIDStr(), f.appIDStr(), "http_request", 1, start, start.Add(time.Duration(secs)*time.Second), "v2", "2")
	}

	af := f.appFilter(base.Add(-time.Hour), base.Add(time.Hour), "UTC", filter.PlotTimeGroupHours)
	items, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, "http_request", af)
	if err != nil {
		t.Fatalf("GetMetricsPlotForSpanNameWithFilter: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 span-metrics rows (one per version), got %d", len(items))
	}

	byVersion := map[string]span.SpanMetricsPlotInstance{}
	for _, item := range items {
		byVersion[item.Version] = item
	}

	v1, ok := byVersion["v1 (1)"]
	if !ok {
		t.Fatalf("missing v1 (1) row in %#v", byVersion)
	}
	v2, ok := byVersion["v2 (2)"]
	if !ok {
		t.Fatalf("missing v2 (2) row in %#v", byVersion)
	}

	v1p50, v1p90, v1p95, v1p99 := spanQuantiles(t, v1, "v1 row")
	v2p50, v2p90, v2p95, v2p99 := spanQuantiles(t, v2, "v2 row")

	assertMonotonicQuantiles(t, v1p50, v1p90, v1p95, v1p99, "v1 row")
	assertMonotonicQuantiles(t, v2p50, v2p90, v2p95, v2p99, "v2 row")
	assertApprox(t, v1p50, 2000.0, 0.01, "v1 p50")
	assertApprox(t, v1p90, 2000.0, 0.01, "v1 p90")
	assertApprox(t, v1p95, 2000.0, 0.01, "v1 p95")
	assertApprox(t, v1p99, 2000.0, 0.01, "v1 p99")
	assertApprox(t, v2p50, 8000.0, 0.01, "v2 p50")
	assertApprox(t, v2p90, 8000.0, 0.01, "v2 p90")
	assertApprox(t, v2p95, 8000.0, 0.01, "v2 p95")
	assertApprox(t, v2p99, 8000.0, 0.01, "v2 p99")

	// Higher-duration version should retain higher quantiles.
	if !(v2p50 > v1p50 && v2p95 > v1p95 && v2p99 > v1p99) {
		t.Fatalf("expected v2 quantiles to be greater than v1: v1=[%.2f %.2f %.2f %.2f], v2=[%.2f %.2f %.2f %.2f]",
			v1p50, v1p90, v1p95, v1p99, v2p50, v2p90, v2p95, v2p99)
	}
}

// expectedCounts returns aggregated per-bucket counts for synthetic seed times.
// withSpanPreBucket=true models span_metrics_mv behavior where rows are first
// bucketed to 15-minute windows before query-time grouping is applied.
func expectedCounts(timestamps []time.Time, group string, withSpanPreBucket bool) map[string]uint64 {
	out := map[string]uint64{}
	for _, ts := range timestamps {
		bucketTS := ts.UTC()
		if withSpanPreBucket {
			bucketTS = bucketTS.Truncate(15 * time.Minute)
		}
		key := formatBucket(bucketTS, group)
		out[key]++
	}
	return out
}

// expectedUniqueBuckets is similar to expectedCounts but keeps only distinct
// bucket keys. Span metric assertions use this when value aggregation itself is
// not part of the behavior under test.
func expectedUniqueBuckets(timestamps []time.Time, group string, withSpanPreBucket bool) map[string]struct{} {
	out := map[string]struct{}{}
	for _, ts := range timestamps {
		bucketTS := ts.UTC()
		if withSpanPreBucket {
			bucketTS = bucketTS.Truncate(15 * time.Minute)
		}
		out[formatBucket(bucketTS, group)] = struct{}{}
	}
	return out
}

// formatBucket mirrors the backend format returned by each plot_time_group.
// It normalizes timestamps to UTC and expected output formats used in API rows.
func formatBucket(ts time.Time, group string) string {
	switch group {
	case filter.PlotTimeGroupMinutes:
		return ts.Truncate(time.Minute).Format("2006-01-02T15:04:05")
	case filter.PlotTimeGroupHours:
		return ts.Truncate(time.Hour).Format("2006-01-02T15:04:05")
	case filter.PlotTimeGroupMonths:
		return time.Date(ts.Year(), ts.Month(), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	case filter.PlotTimeGroupDays:
		fallthrough
	default:
		return time.Date(ts.Year(), ts.Month(), ts.Day(), 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	}
}

// spanMetricTimesForGroup picks timestamps that intentionally cross boundaries
// for each grouping mode. This makes accidental grouping regressions obvious.
func spanMetricTimesForGroup(group string) []time.Time {
	switch group {
	case filter.PlotTimeGroupMinutes:
		return []time.Time{
			time.Date(2026, 1, 5, 10, 15, 10, 0, time.UTC),
			time.Date(2026, 1, 5, 10, 19, 0, 0, time.UTC),
			time.Date(2026, 1, 5, 10, 30, 0, 0, time.UTC),
		}
	case filter.PlotTimeGroupHours:
		return []time.Time{
			time.Date(2026, 1, 5, 10, 2, 0, 0, time.UTC),
			time.Date(2026, 1, 5, 10, 14, 0, 0, time.UTC),
			time.Date(2026, 1, 5, 11, 1, 0, 0, time.UTC),
		}
	case filter.PlotTimeGroupMonths:
		return []time.Time{
			time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC),
			time.Date(2026, 1, 20, 10, 0, 0, 0, time.UTC),
			time.Date(2026, 2, 1, 10, 0, 0, 0, time.UTC),
		}
	default:
		return []time.Time{
			time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC),
			time.Date(2026, 1, 5, 12, 0, 0, 0, time.UTC),
			time.Date(2026, 1, 6, 1, 0, 0, 0, time.UTC),
		}
	}
}

func assertIssueBuckets(t *testing.T, items []event.IssueInstance, expected map[string]uint64) {
	t.Helper()
	got := map[string]uint64{}
	for _, item := range items {
		got[item.DateTime] += *item.Instances
	}
	assertBucketCounts(t, got, expected)
}

func assertSessionBuckets(t *testing.T, items []session.SessionInstance, expected map[string]uint64) {
	t.Helper()
	got := map[string]uint64{}
	for _, item := range items {
		got[item.DateTime] += *item.Instances
	}
	assertBucketCounts(t, got, expected)
}

func assertSpanBuckets(t *testing.T, items []span.SpanMetricsPlotInstance, expected map[string]struct{}) {
	t.Helper()
	got := map[string]struct{}{}
	for _, item := range items {
		got[item.DateTime] = struct{}{}
	}

	if len(got) != len(expected) {
		t.Fatalf("bucket count mismatch: got %d buckets (%v), want %d buckets (%v)", len(got), got, len(expected), expected)
	}

	for key := range expected {
		if _, ok := got[key]; !ok {
			t.Fatalf("missing expected bucket %q in got %v", key, got)
		}
	}
}

func assertBugReportBuckets(t *testing.T, items []BugReportInstance, expected map[string]uint64) {
	t.Helper()
	got := map[string]uint64{}
	for _, item := range items {
		got[item.DateTime] += *item.Instances
	}
	assertBucketCounts(t, got, expected)
}

func assertBucketCounts(t *testing.T, got, expected map[string]uint64) {
	t.Helper()
	if len(got) != len(expected) {
		t.Fatalf("bucket count mismatch: got %d buckets (%v), want %d buckets (%v)", len(got), got, len(expected), expected)
	}

	for key, expectedValue := range expected {
		value, ok := got[key]
		if !ok {
			t.Fatalf("missing expected bucket %q in got %v", key, got)
		}
		if value != expectedValue {
			t.Fatalf("bucket %q mismatch: got %d want %d", key, value, expectedValue)
		}
	}
}

func spanQuantiles(t *testing.T, item span.SpanMetricsPlotInstance, source string) (float64, float64, float64, float64) {
	t.Helper()
	if item.P50 == nil || item.P90 == nil || item.P95 == nil || item.P99 == nil {
		t.Fatalf("expected all quantiles to be non-nil for %s, got p50=%v p90=%v p95=%v p99=%v", source, item.P50, item.P90, item.P95, item.P99)
	}
	return *item.P50, *item.P90, *item.P95, *item.P99
}

func assertMonotonicQuantiles(t *testing.T, p50, p90, p95, p99 float64, source string) {
	t.Helper()
	if !(p50 <= p90 && p90 <= p95 && p95 <= p99) {
		t.Fatalf("expected monotonic quantiles for %s, got p50=%.2f p90=%.2f p95=%.2f p99=%.2f", source, p50, p90, p95, p99)
	}
}

func assertApprox(t *testing.T, got, want, tol float64, source string) {
	t.Helper()
	// Keep quantile checks strict but stable: allow tiny float deltas caused by
	// aggregate-state merge/float representation noise.
	if math.Abs(got-want) > tol {
		t.Fatalf("unexpected %s: got %.4f want %.4f (tol=%.4f)", source, got, want, tol)
	}
}
