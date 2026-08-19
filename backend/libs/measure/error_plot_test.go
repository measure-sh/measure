//go:build integration

package measure

import (
	"context"
	"testing"
	"time"

	"backend/libs/event"
	"backend/libs/filter"
	"backend/testinfra"
)

// 32-char fingerprints (events.exception.fingerprint and anr.fingerprint are
// FixedString(32)).
const (
	fpErrUnhandled = "00000000000000000000000000000001"
	fpErrHandled   = "00000000000000000000000000000002"
	fpErrANR       = "00000000000000000000000000000003"
	fpFatalNew     = "00000000000000000000000000000004"
	fpHandledNew   = "00000000000000000000000000000005"
	fpUnhandledNew = "00000000000000000000000000000006"
)

// sumIssueInstances totals the .Instances pointer values across rows.
func sumIssueInstances(items []event.IssueInstance) uint64 {
	var total uint64
	for _, it := range items {
		if it.Instances != nil {
			total += *it.Instances
		}
	}
	return total
}

// issueBucketCounts maps each row's DateTime bucket to its instance count.
func issueBucketCounts(items []event.IssueInstance) map[string]uint64 {
	got := map[string]uint64{}
	for _, item := range items {
		got[item.DateTime] += *item.Instances
	}
	return got
}

// seedErrorMixWithFingerprints seeds one unhandled exception, one handled
// exception, and one ANR, each with its own fingerprint. All exception
// events have empty exception.severity (legacy-data shape).
func seedErrorMixWithFingerprints(
	ctx context.Context,
	t *testing.T,
	teamID, appID string,
	ts time.Time,
) {
	t.Helper()
	seedIssueEvent(ctx, t, teamID, appID, "exception", fpErrUnhandled, false, ts)
	seedIssueEvent(ctx, t, teamID, appID, "exception", fpErrHandled, true, ts)
	seedIssueEvent(ctx, t, teamID, appID, "anr", fpErrANR, false, ts)
}

// seedErrorMixNewData seeds three exception events with exception.severity
// populated, one fatal, one handled, one unhandled. Mimics the new-SDK
// ingestion shape where severity is set explicitly. No ANR events; this
// helper targets the severity-aware exception branch only.
func seedErrorMixNewData(
	ctx context.Context,
	t *testing.T,
	teamID, appID string,
	ts time.Time,
) {
	t.Helper()
	seedIssueEventWithSeverity(ctx, t, teamID, appID, fpFatalNew, "fatal", ts)
	seedIssueEventWithSeverity(ctx, t, teamID, appID, fpHandledNew, "handled", ts)
	seedIssueEventWithSeverity(ctx, t, teamID, appID, fpUnhandledNew, "unhandled", ts)
}

// seedErrorMixLegacyAndNew seeds two legacy exception events (handled=false,
// handled=true, both with severity='') & three new-data exception events
// (fatal, handled, unhandled with severity populated). Used to verify the
// severity-aware OR clause bridges both data shapes. No ANR events.
func seedErrorMixLegacyAndNew(
	ctx context.Context,
	t *testing.T,
	teamID, appID string,
	ts time.Time,
) {
	t.Helper()
	seedIssueEvent(ctx, t, teamID, appID, "exception", fpErrUnhandled, false, ts)
	seedIssueEvent(ctx, t, teamID, appID, "exception", fpErrHandled, true, ts)
	seedErrorMixNewData(ctx, t, teamID, appID, ts)
}

// --------------------------------------------------------------------------
// GetErrorPlotInstances: overview plot, severity-flag routing
// --------------------------------------------------------------------------

func TestGetErrorPlotInstancesRoutesBySeverity(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	base := func() *filter.AppFilter {
		return f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	}

	cases := []struct {
		name      string
		modify    func(af *filter.AppFilter)
		wantTotal uint64
	}{
		{"type=error with severity=fatal returns only the unhandled exception", func(af *filter.AppFilter) {
			af.ErrorTypes = []event.ErrorType{event.ErrorTypeError}
			af.Severities = []event.Severity{event.SeverityFatal}
		}, 1},
		{"severity=fatal returns only the unhandled exception", func(af *filter.AppFilter) { af.Severities = []event.Severity{event.SeverityFatal} }, 1},
		{"severity=unhandled returns only the unhandled exception", func(af *filter.AppFilter) { af.Severities = []event.Severity{event.SeverityUnhandled} }, 1},
		{"severity=handled returns only the handled exception", func(af *filter.AppFilter) { af.Severities = []event.Severity{event.SeverityHandled} }, 1},
		{"type=error returns both exception events", func(af *filter.AppFilter) { af.ErrorTypes = []event.ErrorType{event.ErrorTypeError} }, 2},
		{"type=anr returns only the ANR", func(af *filter.AppFilter) { af.ErrorTypes = []event.ErrorType{event.ErrorTypeANR} }, 1},
		{"no flags defaults to all sources", func(af *filter.AppFilter) {}, 3},
	}

	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			cleanupAll(f.ctx, t)
			seedErrorMixWithFingerprints(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts)

			af := base()
			c.modify(af)

			items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, af)
			if err != nil {
				t.Fatalf("GetErrorPlotInstances: %v", err)
			}
			if got := sumIssueInstances(items); got != c.wantTotal {
				t.Fatalf("instances = %d, want %d, items=%+v", got, c.wantTotal, items)
			}
		})
	}
}

func TestGetErrorPlotInstancesNewDataSeverity(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	base := func() *filter.AppFilter {
		return f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	}

	cases := []struct {
		name      string
		modify    func(af *filter.AppFilter)
		wantTotal uint64
	}{
		{"severity=fatal returns only the fatal exception", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityFatal}
		}, 1},
		{"severity=handled returns only the handled exception", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityHandled}
		}, 1},
		{"severity=unhandled returns only the unhandled exception", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityUnhandled}
		}, 1},
		{"severity=fatal,handled returns both", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityFatal, event.SeverityHandled}
		}, 2},
		{"severity=fatal,unhandled returns both", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityFatal, event.SeverityUnhandled}
		}, 2},
		{"severity=handled,unhandled returns both", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityHandled, event.SeverityUnhandled}
		}, 2},
		{"severity=fatal,handled,unhandled returns all three exceptions", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityFatal, event.SeverityHandled, event.SeverityUnhandled}
		}, 3},
		{"type=error returns all three exceptions", func(af *filter.AppFilter) {
			af.ErrorTypes = []event.ErrorType{event.ErrorTypeError}
		}, 3},
		{"no flags returns all three exceptions", func(af *filter.AppFilter) {}, 3},
	}

	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			cleanupAll(f.ctx, t)
			seedErrorMixNewData(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts)

			af := base()
			c.modify(af)

			items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, af)
			if err != nil {
				t.Fatalf("GetErrorPlotInstances: %v", err)
			}
			if got := sumIssueInstances(items); got != c.wantTotal {
				t.Fatalf("instances = %d, want %d, items=%+v", got, c.wantTotal, items)
			}
		})
	}
}

func TestGetErrorPlotInstancesMixedLegacyAndNew(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	base := func() *filter.AppFilter {
		return f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	}

	cases := []struct {
		name      string
		modify    func(af *filter.AppFilter)
		wantTotal uint64
	}{
		// Legacy handled=false event maps to fatal AND unhandled.
		// Legacy handled=true event maps to handled.
		// Seeded: 2 legacy exc (false, true) + 3 new exc (fatal, handled, unhandled).
		{"severity=fatal: 1 legacy(false) + 1 new(fatal)", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityFatal}
		}, 2},
		{"severity=unhandled: 1 legacy(false) + 1 new(unhandled)", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityUnhandled}
		}, 2},
		{"severity=handled: 1 legacy(true) + 1 new(handled)", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityHandled}
		}, 2},
		{"severity=fatal,unhandled: 1 legacy(false) + 2 new(fatal,unhandled)", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityFatal, event.SeverityUnhandled}
		}, 3},
		{"severity=fatal,handled: 2 legacy + 2 new(fatal,handled)", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityFatal, event.SeverityHandled}
		}, 4},
		{"severity=handled,unhandled: 2 legacy + 2 new(handled,unhandled)", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityHandled, event.SeverityUnhandled}
		}, 4},
		{"severity=fatal,handled,unhandled: 2 legacy + 3 new", func(af *filter.AppFilter) {
			af.Severities = []event.Severity{event.SeverityFatal, event.SeverityHandled, event.SeverityUnhandled}
		}, 5},
		{"type=error: 2 legacy + 3 new exceptions", func(af *filter.AppFilter) {
			af.ErrorTypes = []event.ErrorType{event.ErrorTypeError}
		}, 5},
		{"no flags: all 5 exception events", func(af *filter.AppFilter) {}, 5},
	}

	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			cleanupAll(f.ctx, t)
			seedErrorMixLegacyAndNew(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts)

			af := base()
			c.modify(af)

			items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, af)
			if err != nil {
				t.Fatalf("GetErrorPlotInstances: %v", err)
			}
			if got := sumIssueInstances(items); got != c.wantTotal {
				t.Fatalf("instances = %d, want %d, items=%+v", got, c.wantTotal, items)
			}
		})
	}
}

func TestGetErrorPlotInstancesMissingTimezone(t *testing.T) {
	f := newPlotFixture(t)
	now := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	af := f.appFilter(now.Add(-time.Hour), now.Add(time.Hour), "", filter.PlotTimeGroupDays)
	if _, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, af); err == nil {
		t.Fatal("expected error for missing timezone")
	}
}

func TestGetErrorPlotInstancesEmptyWhenNoMatchingData(t *testing.T) {
	f := newPlotFixture(t)
	now := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	af := f.appFilter(now.Add(-time.Hour), now.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetErrorPlotInstances: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected empty result, got %d rows", len(items))
	}
}

// --------------------------------------------------------------------------
// GetErrorGroupPlotInstances: detail plot, fingerprint-scoped routing
// --------------------------------------------------------------------------

func TestGetErrorGroupPlotInstancesRoutesBySeverity(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	base := func() *filter.AppFilter {
		return f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	}

	cases := []struct {
		name        string
		fingerprint string
		modify      func(af *filter.AppFilter)
		wantTotal   uint64
	}{
		{"type=error+severity=fatal, unhandled fingerprint", fpErrUnhandled, func(af *filter.AppFilter) {
			af.ErrorTypes = []event.ErrorType{event.ErrorTypeError}
			af.Severities = []event.Severity{event.SeverityFatal}
		}, 1},
		{"type=error+severity=fatal, handled fingerprint returns nothing", fpErrHandled, func(af *filter.AppFilter) {
			af.ErrorTypes = []event.ErrorType{event.ErrorTypeError}
			af.Severities = []event.Severity{event.SeverityFatal}
		}, 0},
		{"severity=fatal, unhandled fingerprint", fpErrUnhandled, func(af *filter.AppFilter) { af.Severities = []event.Severity{event.SeverityFatal} }, 1},
		{"severity=unhandled, unhandled fingerprint", fpErrUnhandled, func(af *filter.AppFilter) { af.Severities = []event.Severity{event.SeverityUnhandled} }, 1},
		{"severity=handled, handled fingerprint", fpErrHandled, func(af *filter.AppFilter) { af.Severities = []event.Severity{event.SeverityHandled} }, 1},
		{"severity=handled, unhandled fingerprint returns nothing", fpErrUnhandled, func(af *filter.AppFilter) { af.Severities = []event.Severity{event.SeverityHandled} }, 0},
		{"type=error, handled fingerprint", fpErrHandled, func(af *filter.AppFilter) { af.ErrorTypes = []event.ErrorType{event.ErrorTypeError} }, 1},
		{"type=error, unhandled fingerprint", fpErrUnhandled, func(af *filter.AppFilter) { af.ErrorTypes = []event.ErrorType{event.ErrorTypeError} }, 1},
		{"type=anr, ANR fingerprint", fpErrANR, func(af *filter.AppFilter) { af.ErrorTypes = []event.ErrorType{event.ErrorTypeANR} }, 1},
		{"type=anr, exception fingerprint returns nothing", fpErrUnhandled, func(af *filter.AppFilter) { af.ErrorTypes = []event.ErrorType{event.ErrorTypeANR} }, 0},
		{"no flags default, ANR fingerprint", fpErrANR, func(af *filter.AppFilter) {}, 1},
		{"no flags default, unhandled exception fingerprint", fpErrUnhandled, func(af *filter.AppFilter) {}, 1},
		{"no flags default, handled exception fingerprint", fpErrHandled, func(af *filter.AppFilter) {}, 1},
	}

	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			cleanupAll(f.ctx, t)
			seedErrorMixWithFingerprints(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts)

			af := base()
			c.modify(af)

			items, err := f.app.GetErrorGroupPlotInstances(f.ctx, deps.RchPool, c.fingerprint, af)
			if err != nil {
				t.Fatalf("GetErrorGroupPlotInstances: %v", err)
			}
			if got := sumIssueInstances(items); got != c.wantTotal {
				t.Fatalf("instances = %d, want %d, items=%+v", got, c.wantTotal, items)
			}
		})
	}
}

func TestGetErrorGroupPlotInstancesMissingTimezone(t *testing.T) {
	f := newPlotFixture(t)
	now := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	af := f.appFilter(now.Add(-time.Hour), now.Add(time.Hour), "", filter.PlotTimeGroupDays)
	if _, err := f.app.GetErrorGroupPlotInstances(f.ctx, deps.RchPool, fpErrUnhandled, af); err == nil {
		t.Fatal("expected error for missing timezone")
	}
}

// --------------------------------------------------------------------------
// GetErrorPlotInstances & GetErrorGroupPlotInstances: bucketing & defaults
// --------------------------------------------------------------------------

func TestGetErrorPlotInstancesDefaultsToDaysWhenPlotTimeGroupMissing(t *testing.T) {
	f := newPlotFixture(t)

	t1 := time.Date(2026, 1, 5, 10, 15, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 5, 22, 15, 0, 0, time.UTC)
	t3 := time.Date(2026, 1, 6, 1, 15, 0, 0, time.UTC)
	for _, ts := range []time.Time{t1, t2, t3} {
		seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", "", false, ts)
	}

	af := f.appFilter(t1.Add(-time.Hour), t3.Add(time.Hour), "UTC", "")

	items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetErrorPlotInstances: %v", err)
	}
	assertBucketCounts(t, issueBucketCounts(items), expectedCounts([]time.Time{t1, t2, t3}, filter.PlotTimeGroupDays, false))
}

func TestGetErrorGroupPlotInstancesDefaultsToDaysWhenPlotTimeGroupMissing(t *testing.T) {
	f := newPlotFixture(t)

	fp := "12345678901234567890123456789012"
	t1 := time.Date(2026, 1, 5, 10, 15, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 6, 1, 15, 0, 0, time.UTC)
	seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", fp, false, t1)
	seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", fp, false, t2)

	af := f.appFilter(t1.Add(-time.Hour), t2.Add(time.Hour), "UTC", "")

	items, err := f.app.GetErrorGroupPlotInstances(f.ctx, deps.RchPool, fp, af)
	if err != nil {
		t.Fatalf("GetErrorGroupPlotInstances: %v", err)
	}
	assertBucketCounts(t, issueBucketCounts(items), expectedCounts([]time.Time{t1, t2}, filter.PlotTimeGroupDays, false))
}

// --------------------------------------------------------------------------
// GetErrorPlotInstances: timezone bucketing
// --------------------------------------------------------------------------

func TestGetErrorPlotInstancesRespectsTimezoneBucketing(t *testing.T) {
	f := newPlotFixture(t)

	// 2026-01-05T23:30Z becomes 2026-01-06 in Asia/Kolkata (+05:30).
	ts := time.Date(2026, 1, 5, 23, 30, 0, 0, time.UTC)
	seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", "", false, ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "Asia/Kolkata", filter.PlotTimeGroupDays)
	items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetErrorPlotInstances: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 day bucket, got %d", len(items))
	}
	if items[0].DateTime != "2026-01-06" {
		t.Fatalf("expected timezone-shifted day bucket 2026-01-06, got %q", items[0].DateTime)
	}
}

// --------------------------------------------------------------------------
// Version filter, applied by the applyCommonFilters closure inside each
// function. GetErrorPlotInstances & GetErrorGroupPlotInstances each define
// their own local applyCommonFilters, so version filtering is not shared
// code & needs coverage on both.
// --------------------------------------------------------------------------

func TestGetErrorPlotInstancesFiltersByVersion(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	seedEventRows(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, testinfra.EventRow{
		Type: "exception", Timestamp: ts, AppVersion: "v1", AppBuild: "1",
	})
	seedEventRows(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, testinfra.EventRow{
		Type: "exception", Timestamp: ts, AppVersion: "v2", AppBuild: "2",
	})

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	af.Versions = []string{"v1"}
	af.VersionCodes = []string{"1"}

	items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetErrorPlotInstances: %v", err)
	}
	if got := sumIssueInstances(items); got != 1 {
		t.Fatalf("instances = %d, want 1, items=%+v", got, items)
	}
	for _, it := range items {
		if it.Version != "v1(1)" {
			t.Fatalf("expected only v1(1) version bucket, got %q", it.Version)
		}
	}
}

func TestGetErrorGroupPlotInstancesFiltersByVersion(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	fp := "12345678901234567890123456789012"

	seedEventRows(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, testinfra.EventRow{
		Type: "exception", Fingerprint: fp, Timestamp: ts, AppVersion: "v1", AppBuild: "1",
	})
	seedEventRows(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, testinfra.EventRow{
		Type: "exception", Fingerprint: fp, Timestamp: ts, AppVersion: "v2", AppBuild: "2",
	})

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	af.Versions = []string{"v1"}
	af.VersionCodes = []string{"1"}

	items, err := f.app.GetErrorGroupPlotInstances(f.ctx, deps.RchPool, fp, af)
	if err != nil {
		t.Fatalf("GetErrorGroupPlotInstances: %v", err)
	}
	if got := sumIssueInstances(items); got != 1 {
		t.Fatalf("instances = %d, want 1, items=%+v", got, items)
	}
	for _, it := range items {
		if it.Version != "v1 (1)" {
			t.Fatalf("expected only v1 (1) version bucket, got %q", it.Version)
		}
	}
}

func TestGetErrorGroupPlotInstancesEmptyForUnknownFingerprint(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	seedErrorMixWithFingerprints(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	items, err := f.app.GetErrorGroupPlotInstances(f.ctx, deps.RchPool, "ffffffffffffffffffffffffffffffff", af)
	if err != nil {
		t.Fatalf("GetErrorGroupPlotInstances: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected empty result for unknown fingerprint, got %d rows", len(items))
	}
}
