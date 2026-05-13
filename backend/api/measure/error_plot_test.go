//go:build integration

package measure

import (
	"context"
	"testing"
	"time"

	"backend/api/event"
	"backend/api/filter"
)

// 32-char fingerprints (events.exception.fingerprint and anr.fingerprint are
// FixedString(32)).
const (
	fpErrUnhandled = "00000000000000000000000000000001"
	fpErrHandled   = "00000000000000000000000000000002"
	fpErrANR       = "00000000000000000000000000000003"
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

// seedErrorMixWithFingerprints seeds one unhandled exception, one handled
// exception, and one ANR — each with its own fingerprint.
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

// --------------------------------------------------------------------------
// GetErrorPlotInstances — overview plot, severity-flag routing
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
		{"crash flag returns only the unhandled exception", func(af *filter.AppFilter) { af.Crash = true }, 1},
		{"severity=fatal returns only the unhandled exception", func(af *filter.AppFilter) { af.Severity = event.SeverityFatal }, 1},
		{"severity=unhandled returns only the unhandled exception", func(af *filter.AppFilter) { af.Severity = event.SeverityUnhandled }, 1},
		{"severity=handled returns only the handled exception", func(af *filter.AppFilter) { af.Severity = event.SeverityHandled }, 1},
		{"error flag returns both exception events", func(af *filter.AppFilter) { af.Error = true }, 2},
		{"anr flag returns only the ANR", func(af *filter.AppFilter) { af.ANR = true }, 1},
		{"no flags defaults to all sources", func(af *filter.AppFilter) {}, 3},
	}

	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			cleanupAll(f.ctx, t)
			seedErrorMixWithFingerprints(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts)

			af := base()
			c.modify(af)

			items, err := f.app.GetErrorPlotInstances(f.ctx, af)
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
	if _, err := f.app.GetErrorPlotInstances(f.ctx, af); err == nil {
		t.Fatal("expected error for missing timezone")
	}
}

func TestGetErrorPlotInstancesEmptyWhenNoMatchingData(t *testing.T) {
	f := newPlotFixture(t)
	now := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	af := f.appFilter(now.Add(-time.Hour), now.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	items, err := f.app.GetErrorPlotInstances(f.ctx, af)
	if err != nil {
		t.Fatalf("GetErrorPlotInstances: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected empty result, got %d rows", len(items))
	}
}

// --------------------------------------------------------------------------
// GetErrorGroupPlotInstances — detail plot, fingerprint-scoped routing
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
		{"crash flag, unhandled fingerprint", fpErrUnhandled, func(af *filter.AppFilter) { af.Crash = true }, 1},
		{"crash flag, handled fingerprint returns nothing", fpErrHandled, func(af *filter.AppFilter) { af.Crash = true }, 0},
		{"severity=fatal, unhandled fingerprint", fpErrUnhandled, func(af *filter.AppFilter) { af.Severity = event.SeverityFatal }, 1},
		{"severity=unhandled, unhandled fingerprint", fpErrUnhandled, func(af *filter.AppFilter) { af.Severity = event.SeverityUnhandled }, 1},
		{"severity=handled, handled fingerprint", fpErrHandled, func(af *filter.AppFilter) { af.Severity = event.SeverityHandled }, 1},
		{"severity=handled, unhandled fingerprint returns nothing", fpErrUnhandled, func(af *filter.AppFilter) { af.Severity = event.SeverityHandled }, 0},
		{"error flag, handled fingerprint", fpErrHandled, func(af *filter.AppFilter) { af.Error = true }, 1},
		{"error flag, unhandled fingerprint", fpErrUnhandled, func(af *filter.AppFilter) { af.Error = true }, 1},
		{"anr flag, ANR fingerprint", fpErrANR, func(af *filter.AppFilter) { af.ANR = true }, 1},
		{"anr flag, exception fingerprint returns nothing", fpErrUnhandled, func(af *filter.AppFilter) { af.ANR = true }, 0},
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

			items, err := f.app.GetErrorGroupPlotInstances(f.ctx, c.fingerprint, af)
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
	if _, err := f.app.GetErrorGroupPlotInstances(f.ctx, fpErrUnhandled, af); err == nil {
		t.Fatal("expected error for missing timezone")
	}
}

func TestGetErrorGroupPlotInstancesEmptyForUnknownFingerprint(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	seedErrorMixWithFingerprints(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	items, err := f.app.GetErrorGroupPlotInstances(f.ctx, "ffffffffffffffffffffffffffffffff", af)
	if err != nil {
		t.Fatalf("GetErrorGroupPlotInstances: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected empty result for unknown fingerprint, got %d rows", len(items))
	}
}
