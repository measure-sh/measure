//go:build integration

package measure

import (
	"testing"
	"time"

	"backend/libs/filter"
	"backend/testinfra"
)

// GetIssueFreeMetrics must compute crash free percentages for the
// selected app versions and, independently, for the unselected ones.
func TestGetIssueFreeMetricsUnselected(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	// Selected version v1: 8 plain sessions + 1 fatal crash -> 9 sessions, 1 crash.
	seedEventRows(f.ctx, t, team, app, 8, testinfra.EventRow{AppVersion: "v1", AppBuild: "1", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{Type: "exception", AppVersion: "v1", AppBuild: "1", Severity: "fatal", Timestamp: ts})

	// Unselected version v2 with a different crash rate: 8 plain + 2 fatal crashes -> 10 sessions, 2 crashes.
	seedEventRows(f.ctx, t, team, app, 8, testinfra.EventRow{AppVersion: "v2", AppBuild: "2", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 2, testinfra.EventRow{Type: "exception", AppVersion: "v2", AppBuild: "2", Severity: "fatal", Timestamp: ts})

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	af.Versions = []string{"v1"}
	af.VersionCodes = []string{"1"}

	crashFree, perceivedCrashFree, _, _, err := f.app.GetIssueFreeMetrics(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetIssueFreeMetrics: %v", err)
	}

	// selected: (1 - 1/9) * 100 = 88.89, unselected: (1 - 2/10) * 100 = 80.
	const wantCrashFree = 88.89
	const wantUnselected = 80.0

	if crashFree.CrashFreeSessions != wantCrashFree {
		t.Errorf("crashFree.CrashFreeSessions = %v, want %v", crashFree.CrashFreeSessions, wantCrashFree)
	}
	if crashFree.UnselectedCrashFreeSessions != wantUnselected {
		t.Errorf("crashFree.UnselectedCrashFreeSessions = %v, want %v", crashFree.UnselectedCrashFreeSessions, wantUnselected)
	}
	if crashFree.UnselectedNoData {
		t.Error("crashFree.UnselectedNoData = true, want false")
	}

	// Seeds hardcode exception.foreground=true, so perceived values equal
	// non-perceived ones here.
	if perceivedCrashFree.UnselectedCrashFreeSessions != wantUnselected {
		t.Errorf("perceivedCrashFree.UnselectedCrashFreeSessions = %v, want %v", perceivedCrashFree.UnselectedCrashFreeSessions, wantUnselected)
	}
}

// When the filter matches every seeded app version, there are no
// unselected sessions, so the unselected side must report no data
// with a zero value.
func TestGetIssueFreeMetricsUnselectedNoData(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	seedEventRows(f.ctx, t, team, app, 9, testinfra.EventRow{AppVersion: "v1", AppBuild: "1", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{Type: "exception", AppVersion: "v1", AppBuild: "1", Severity: "fatal", Timestamp: ts})

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	af.Versions = []string{"v1"}
	af.VersionCodes = []string{"1"}

	crashFree, perceivedCrashFree, _, _, err := f.app.GetIssueFreeMetrics(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetIssueFreeMetrics: %v", err)
	}

	if !crashFree.UnselectedNoData {
		t.Error("crashFree.UnselectedNoData = false, want true")
	}
	if crashFree.UnselectedCrashFreeSessions != 0 {
		t.Errorf("crashFree.UnselectedCrashFreeSessions = %v, want 0", crashFree.UnselectedCrashFreeSessions)
	}
	if !perceivedCrashFree.UnselectedNoData {
		t.Error("perceivedCrashFree.UnselectedNoData = false, want true")
	}
}
