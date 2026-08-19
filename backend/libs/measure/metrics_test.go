//go:build integration

package measure

import (
	"testing"
	"time"

	"backend/libs/filter"
	"backend/testinfra"
)

// GetIssueFreeMetrics must compute both crashFree.Delta & perceivedCrashFree.Delta
// as ratios against their own unselected baselines.
func TestGetIssueFreeMetricsDeltas(t *testing.T) {
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

	var unselected filter.Versions
	unselected.Add("v2", "2")

	crashFree, perceivedCrashFree, _, _, err := f.app.GetIssueFreeMetrics(f.ctx, deps.RchPool, af, unselected)
	if err != nil {
		t.Fatalf("GetIssueFreeMetrics: %v", err)
	}

	// selected: (1 - 1/9) * 100 = 88.89, unselected: (1 - 2/10) * 100 = 80.
	// RoundTwoDecimalsFloat64 rounds up (math.Ceil), so
	// delta = ceil(88.89 / 80 * 100) / 100 = 1.12.
	const wantCrashFree = 88.89
	const wantDelta = 1.12

	if crashFree.CrashFreeSessions != wantCrashFree {
		t.Errorf("crashFree.CrashFreeSessions = %v, want %v", crashFree.CrashFreeSessions, wantCrashFree)
	}
	if crashFree.Delta != wantDelta {
		t.Errorf("crashFree.Delta = %v, want %v", crashFree.Delta, wantDelta)
	}

	// Seeds hardcode exception.foreground=true, so perceived values equal
	// non-perceived ones here.
	if perceivedCrashFree.Delta != wantDelta {
		t.Errorf("perceivedCrashFree.Delta = %v, want %v", perceivedCrashFree.Delta, wantDelta)
	}
}
