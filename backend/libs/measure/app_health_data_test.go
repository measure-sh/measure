//go:build integration

package measure

import (
	"testing"
	"time"

	"backend/libs/filter"
	"backend/testinfra"

	"github.com/google/uuid"
)

// Only data within [from, to] is counted; earlier and later data is excluded
// from all three series.
func TestGetHealthPlotInstancesTimeRange(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 3, 15, 12, 0, 0, 0, time.UTC)
	before := ts.AddDate(0, 0, -30)
	after := ts.AddDate(0, 0, 30)

	seedAppMetrics(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts, 5, 1, 1)     // in range
	seedAppMetrics(f.ctx, t, f.teamIDStr(), f.appIDStr(), before, 9, 9, 9) // before from
	seedAppMetrics(f.ctx, t, f.teamIDStr(), f.appIDStr(), after, 9, 9, 9)  // after to

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetHealthPlotInstances: %v", err)
	}
	if got := sumHealthInstances(sessions); got != 7 {
		t.Errorf("sessions = %d, want 7 (out-of-range excluded)", got)
	}
	if got := sumHealthInstances(crashes); got != 1 {
		t.Errorf("crashes = %d, want 1 (out-of-range excluded)", got)
	}
	if got := sumHealthInstances(anrs); got != 1 {
		t.Errorf("anrs = %d, want 1 (out-of-range excluded)", got)
	}
}

// Data is scoped to the requesting team AND app: another app in the same team,
// and the same app id under a different team, are both excluded.
func TestGetHealthPlotInstancesAppTeamIsolation(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 3, 15, 12, 0, 0, 0, time.UTC)

	seedAppMetrics(f.ctx, t, f.teamIDStr(), f.appIDStr(), ts, 5, 1, 1) // this app

	// same team, different app → excluded by app_id filter.
	seedAppMetrics(f.ctx, t, f.teamIDStr(), uuid.NewString(), ts, 9, 9, 9)
	// different team, same app id → excluded by team_id filter.
	seedAppMetrics(f.ctx, t, uuid.NewString(), f.appIDStr(), ts, 9, 9, 9)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetHealthPlotInstances: %v", err)
	}
	if got := sumHealthInstances(sessions); got != 7 {
		t.Errorf("sessions = %d, want 7 (other app/team excluded)", got)
	}
	if got := sumHealthInstances(crashes); got != 1 {
		t.Errorf("crashes = %d, want 1 (other app/team excluded)", got)
	}
	if got := sumHealthInstances(anrs); got != 1 {
		t.Errorf("anrs = %d, want 1 (other app/team excluded)", got)
	}
}

// Each series is independent: a metric with no data comes back empty while the
// others are populated.
func TestGetHealthPlotInstancesPartialSeries(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 3, 15, 12, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()
	base := func() *filter.AppFilter {
		return f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	}

	t.Run("only sessions, no errors", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedGenericEvents(f.ctx, t, team, app, 5, ts)

		sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, base())
		if err != nil {
			t.Fatalf("GetHealthPlotInstances: %v", err)
		}
		if got := sumHealthInstances(sessions); got != 5 {
			t.Errorf("sessions = %d, want 5", got)
		}
		if len(crashes) != 0 || len(anrs) != 0 {
			t.Errorf("expected no crashes/anrs, got crashes=%v anrs=%v", crashes, anrs)
		}
	})

	t.Run("crashes without ANRs", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedGenericEvents(f.ctx, t, team, app, 3, ts)
		seedIssueEvent(f.ctx, t, team, app, "exception", "", false, ts) // fatal crash

		sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, base())
		if err != nil {
			t.Fatalf("GetHealthPlotInstances: %v", err)
		}
		if got := sumHealthInstances(sessions); got != 4 {
			t.Errorf("sessions = %d, want 4", got)
		}
		if got := sumHealthInstances(crashes); got != 1 {
			t.Errorf("crashes = %d, want 1", got)
		}
		if len(anrs) != 0 {
			t.Errorf("expected no anrs, got %v", anrs)
		}
	})

	t.Run("ANRs without crashes", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedGenericEvents(f.ctx, t, team, app, 3, ts)
		seedIssueEvent(f.ctx, t, team, app, "anr", "", false, ts)

		sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, base())
		if err != nil {
			t.Fatalf("GetHealthPlotInstances: %v", err)
		}
		if got := sumHealthInstances(sessions); got != 4 {
			t.Errorf("sessions = %d, want 4", got)
		}
		if got := sumHealthInstances(anrs); got != 1 {
			t.Errorf("anrs = %d, want 1", got)
		}
		if len(crashes) != 0 {
			t.Errorf("expected no crashes, got %v", crashes)
		}
	})

	t.Run("only non-fatal exceptions yields no crashes", func(t *testing.T) {
		cleanupAll(f.ctx, t)
		seedIssueEventWithSeverity(f.ctx, t, team, app, "", "handled", ts)
		seedIssueEventWithSeverity(f.ctx, t, team, app, "", "unhandled", ts)

		sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, base())
		if err != nil {
			t.Fatalf("GetHealthPlotInstances: %v", err)
		}
		// the two exceptions are still sessions, but neither is a crash.
		if got := sumHealthInstances(sessions); got != 2 {
			t.Errorf("sessions = %d, want 2", got)
		}
		if len(crashes) != 0 {
			t.Errorf("expected no crashes from non-fatal exceptions, got %v", crashes)
		}
		if len(anrs) != 0 {
			t.Errorf("expected no anrs, got %v", anrs)
		}
	})
}

// Data from multiple app versions in the same bucket is summed when unfiltered,
// and narrowed to the selected version when a version filter is applied — across
// all three series.
func TestGetHealthPlotInstancesMultipleVersions(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 3, 15, 12, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	// v1: 5 generic sessions + 1 crash. v2: 3 generic sessions + 1 crash + 1 anr.
	seedEventRows(f.ctx, t, team, app, 5, testinfra.EventRow{AppVersion: "v1", AppBuild: "1", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{Type: "exception", AppVersion: "v1", AppBuild: "1", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 3, testinfra.EventRow{AppVersion: "v2", AppBuild: "2", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{Type: "exception", AppVersion: "v2", AppBuild: "2", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{Type: "anr", AppVersion: "v2", AppBuild: "2", Timestamp: ts})

	t.Run("no version filter sums across versions", func(t *testing.T) {
		af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
		sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
		if err != nil {
			t.Fatalf("GetHealthPlotInstances: %v", err)
		}
		if got := sumHealthInstances(sessions); got != 11 { // 6 (v1) + 5 (v2)
			t.Errorf("sessions = %d, want 11", got)
		}
		if got := sumHealthInstances(crashes); got != 2 {
			t.Errorf("crashes = %d, want 2", got)
		}
		if got := sumHealthInstances(anrs); got != 1 {
			t.Errorf("anrs = %d, want 1", got)
		}
	})

	t.Run("version filter selects a single version", func(t *testing.T) {
		af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
		af.Versions = []string{"v2"}
		af.VersionCodes = []string{"2"}
		sessions, crashes, anrs, err := f.app.GetHealthPlotInstances(f.ctx, deps.RchPool, af)
		if err != nil {
			t.Fatalf("GetHealthPlotInstances: %v", err)
		}
		if got := sumHealthInstances(sessions); got != 5 { // 3 generic + 1 crash + 1 anr
			t.Errorf("sessions = %d, want 5", got)
		}
		if got := sumHealthInstances(crashes); got != 1 {
			t.Errorf("crashes = %d, want 1", got)
		}
		if got := sumHealthInstances(anrs); got != 1 {
			t.Errorf("anrs = %d, want 1", got)
		}
	})
}
