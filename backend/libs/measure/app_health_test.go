//go:build integration

package measure

import (
	"strings"
	"testing"
	"time"

	"backend/libs/filter"
)

// sumHealthInstances returns the total instances across all buckets of a series.
func sumHealthInstances(items []HealthInstance) uint64 {
	var total uint64
	for _, it := range items {
		total += it.Instances
	}
	return total
}

// healthByDate maps each bucket's datetime label to its instance count.
func healthByDate(items []HealthInstance) map[string]uint64 {
	m := make(map[string]uint64, len(items))
	for _, it := range items {
		m[it.DateTime] = it.Instances
	}
	return m
}

// dateOf returns the first bucket's datetime label, or "" when empty. Used
// alongside requireSingleDateBucket, which asserts the single-bucket invariant.
func dateOf(items []HealthInstance) string {
	if len(items) == 0 {
		return ""
	}
	return items[0].DateTime
}

// With no data seeded, every series comes back empty.
func TestGetHealthPlotInstancesEmpty(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)

	sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetHealthPlotInstances: %v", err)
	}
	if len(sessions) != 0 || len(crashes) != 0 || len(anrs) != 0 {
		t.Fatalf("expected all series empty, got sessions=%v crashes=%v anrs=%v", sessions, crashes, anrs)
	}
}

// Sessions are counted like the adoption metric (uniqMerge over app_metrics),
// crashes are fatal exceptions and ANRs are anr events — all in one bucket.
func TestGetHealthPlotInstancesCounts(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	// 10 plain sessions, 2 crash sessions (unhandled exceptions), 1 ANR session.
	seedAppMetrics(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts, 10, 2, 1)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetHealthPlotInstances: %v", err)
	}

	requireSingleDateBucket(t, sessions, dateOf(sessions), "2026-01-05", "sessions")
	if got := sumHealthInstances(sessions); got != 13 {
		t.Errorf("sessions = %d, want 13 (10 generic + 2 crash + 1 anr)", got)
	}
	requireSingleDateBucket(t, crashes, dateOf(crashes), "2026-01-05", "crashes")
	if got := sumHealthInstances(crashes); got != 2 {
		t.Errorf("crashes = %d, want 2", got)
	}
	requireSingleDateBucket(t, anrs, dateOf(anrs), "2026-01-05", "anrs")
	if got := sumHealthInstances(anrs); got != 1 {
		t.Errorf("anrs = %d, want 1", got)
	}
}

// Crashes count fatal exceptions only, bridging the new exception.severity field
// and legacy data (empty severity falls back to exception.handled = false).
// Non-fatal exceptions (unhandled/handled severity, or legacy handled) are excluded.
func TestGetHealthPlotInstancesCrashSeverity(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	// New-SDK severity-tagged exceptions.
	seedIssueEventWithSeverity(f.ctx, t, team, app, "", "fatal", ts)     // crash
	seedIssueEventWithSeverity(f.ctx, t, team, app, "", "unhandled", ts) // not a crash
	seedIssueEventWithSeverity(f.ctx, t, team, app, "", "handled", ts)   // not a crash
	// Legacy exceptions without severity: the handled flag decides fatality.
	seedIssueEvent(f.ctx, t, team, app, "exception", "", false, ts) // crash (legacy fatal)
	seedIssueEvent(f.ctx, t, team, app, "exception", "", true, ts)  // not a crash (handled)
	// One ANR.
	seedIssueEvent(f.ctx, t, team, app, "anr", "", false, ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetHealthPlotInstances: %v", err)
	}

	if got := sumHealthInstances(crashes); got != 2 {
		t.Errorf("crashes = %d, want 2 (severity=fatal + legacy handled=false)", got)
	}
	if got := sumHealthInstances(anrs); got != 1 {
		t.Errorf("anrs = %d, want 1", got)
	}
	// Each seeded event uses a unique session, so app_metrics sees 6 sessions.
	if got := sumHealthInstances(sessions); got != 6 {
		t.Errorf("sessions = %d, want 6", got)
	}
}

// Version filtering applies to all three series: the seeded version returns
// counts; an unknown version returns nothing.
func TestGetHealthPlotInstancesVersionFilter(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	// Seed helpers tag every event with app_version "v1" / build "1".
	seedAppMetrics(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts, 5, 1, 1)

	t.Run("matching version returns counts", func(t *testing.T) {
		af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
		af.Versions = []string{"v1"}
		af.VersionCodes = []string{"1"}
		sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
		if err != nil {
			t.Fatalf("GetHealthPlotInstances: %v", err)
		}
		if got := sumHealthInstances(sessions); got != 7 {
			t.Errorf("sessions = %d, want 7", got)
		}
		if got := sumHealthInstances(crashes); got != 1 {
			t.Errorf("crashes = %d, want 1", got)
		}
		if got := sumHealthInstances(anrs); got != 1 {
			t.Errorf("anrs = %d, want 1", got)
		}
	})

	t.Run("non-matching version returns nothing", func(t *testing.T) {
		af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
		af.Versions = []string{"v2"}
		af.VersionCodes = []string{"2"}
		sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
		if err != nil {
			t.Fatalf("GetHealthPlotInstances: %v", err)
		}
		if len(sessions) != 0 || len(crashes) != 0 || len(anrs) != 0 {
			t.Fatalf("expected empty series for unknown version, got sessions=%v crashes=%v anrs=%v", sessions, crashes, anrs)
		}
	})
}

// Data spanning multiple days is split into per-day buckets, and crash/ANR
// series stay sparse (a bucket with no crashes/ANRs is absent).
func TestGetHealthPlotInstancesTimeBuckets(t *testing.T) {
	f := newPlotFixture(t)
	day1 := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	day2 := time.Date(2026, 1, 6, 10, 0, 0, 0, time.UTC)

	seedAppMetrics(f.ctx, t, f.teamIDStr(), f.appIDStr(), day1, 3, 2, 0) // day1: 5 sessions, 2 crashes
	seedAppMetrics(f.ctx, t, f.teamIDStr(), f.appIDStr(), day2, 2, 0, 3) // day2: 5 sessions, 3 anrs

	af := f.appFilter(day1.Add(-time.Hour), day2.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetHealthPlotInstances: %v", err)
	}

	if s := healthByDate(sessions); len(s) != 2 || s["2026-01-05"] != 5 || s["2026-01-06"] != 5 {
		t.Errorf("sessions by date = %v, want {2026-01-05:5, 2026-01-06:5}", s)
	}
	if c := healthByDate(crashes); len(c) != 1 || c["2026-01-05"] != 2 {
		t.Errorf("crashes by date = %v, want {2026-01-05:2}", c)
	}
	if a := healthByDate(anrs); len(a) != 1 || a["2026-01-06"] != 3 {
		t.Errorf("anrs by date = %v, want {2026-01-06:3}", a)
	}
}

// A missing timezone is rejected before any query runs.
func TestGetHealthPlotInstancesMissingTimezone(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "", filter.PlotTimeGroupDays)

	_, _, _, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
	if err == nil || !strings.Contains(err.Error(), "timezone") {
		t.Fatalf("expected timezone error, got %v", err)
	}
}

// When plot_time_group is unset it defaults to daily buckets.
func TestGetHealthPlotInstancesDefaultsPlotTimeGroup(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	seedAppMetrics(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts, 4, 1, 0)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", "") // no plot_time_group
	sessions, crashes, _, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetHealthPlotInstances: %v", err)
	}
	requireSingleDateBucket(t, sessions, dateOf(sessions), "2026-01-05", "sessions")
	if got := sumHealthInstances(sessions); got != 5 {
		t.Errorf("sessions = %d, want 5", got)
	}
	if got := sumHealthInstances(crashes); got != 1 {
		t.Errorf("crashes = %d, want 1", got)
	}
}

// Buckets are computed in the request timezone for both the sessions and the
// crash/ANR queries, so they agree. 23:30 UTC on Jan 5 is Jan 6 in Asia/Kolkata.
func TestGetHealthPlotInstancesTimezoneBucketing(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 23, 30, 0, 0, time.UTC)
	seedAppMetrics(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts, 1, 1, 0)

	af := f.appFilter(
		time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 1, 6, 23, 59, 0, 0, time.UTC),
		"Asia/Kolkata", filter.PlotTimeGroupDays)
	sessions, crashes, _, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetHealthPlotInstances: %v", err)
	}
	requireSingleDateBucket(t, sessions, dateOf(sessions), "2026-01-06", "sessions")
	requireSingleDateBucket(t, crashes, dateOf(crashes), "2026-01-06", "crashes")
}
