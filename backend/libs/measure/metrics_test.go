//go:build integration

package measure

import (
	"testing"
	"time"

	"backend/libs/filter"
	"backend/libs/metrics"
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

	flt := f.appHealthFilter(t, ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays, "version_name:in:v1 AND version_code:in:1")

	crashFree, perceivedCrashFree, _, _, err := f.app.GetIssueFreeMetrics(f.ctx, deps.RchPool, flt)
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

	flt := f.appHealthFilter(t, ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays, "version_name:in:v1 AND version_code:in:1")

	crashFree, perceivedCrashFree, _, _, err := f.app.GetIssueFreeMetrics(f.ctx, deps.RchPool, flt)
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

// With no filter expression every row is selected, so the selected side
// covers the whole app and the unselected side has no sessions to compute a
// percentage from.
func TestGetIssueFreeMetricsWithoutFilterExpr(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	seedEventRows(f.ctx, t, team, app, 8, testinfra.EventRow{AppVersion: "v1", AppBuild: "1", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{Type: "exception", AppVersion: "v1", AppBuild: "1", Severity: "fatal", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{Type: "exception", AppVersion: "v2", AppBuild: "2", Severity: "fatal", Timestamp: ts})

	flt := f.appHealthFilter(t, ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays, "")

	crashFree, _, _, _, err := f.app.GetIssueFreeMetrics(f.ctx, deps.RchPool, flt)
	if err != nil {
		t.Fatalf("GetIssueFreeMetrics: %v", err)
	}

	// 10 sessions across both versions, 2 of them crashed.
	if want := 80.0; crashFree.CrashFreeSessions != want {
		t.Errorf("crashFree.CrashFreeSessions = %v, want %v", crashFree.CrashFreeSessions, want)
	}
	if !crashFree.UnselectedNoData {
		t.Error("crashFree.UnselectedNoData = false, want true")
	}
}

// Adoption compares the selected versions against every version of the app,
// so an unfiltered request adopts the whole app.
func TestGetAdoptionMetrics(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	seedEventRows(f.ctx, t, team, app, 3, testinfra.EventRow{AppVersion: "v1", AppBuild: "1", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{AppVersion: "v2", AppBuild: "2", Timestamp: ts})

	adopt := func(t *testing.T, filterExpr string) *metrics.SessionAdoption {
		t.Helper()
		flt := f.appHealthFilter(t, ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays, filterExpr)
		adoption, err := f.app.GetAdoptionMetrics(f.ctx, deps.RchPool, flt)
		if err != nil {
			t.Fatalf("GetAdoptionMetrics: %v", err)
		}
		return adoption
	}

	t.Run("no filter expression adopts every version", func(t *testing.T) {
		adoption := adopt(t, "")
		if adoption.SelectedVersion != 4 || adoption.AllVersions != 4 || adoption.Adoption != 100 {
			t.Errorf("adoption = %+v, want 4 of 4 at 100%%", adoption)
		}
	})

	t.Run("a filter expression adopts the selected version", func(t *testing.T) {
		adoption := adopt(t, "version_name:in:v1 AND version_code:in:1")
		if adoption.SelectedVersion != 3 || adoption.AllVersions != 4 || adoption.Adoption != 75 {
			t.Errorf("adoption = %+v, want 3 of 4 at 75%%", adoption)
		}
	})
}

// App size is a property of one build, so it is reported only when the filter
// narrows the app to a single version name, and then for that version's most
// recent build.
func TestGetSizeMetrics(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	seedTeam(f.ctx, t, f.teamID, testTeamName)
	seedApp(f.ctx, t, f.appID, f.teamID, 90)
	onboarded := App{ID: &f.appID, TeamId: f.teamID, Onboarded: true}

	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{AppVersion: "v1", AppBuild: "1", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{AppVersion: "v2", AppBuild: "2", Timestamp: ts})
	seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{AppVersion: "v3", AppBuild: "3", Timestamp: ts})

	seedBuildSize(f.ctx, t, f.appID, "v1", "1", 1000)
	seedBuildSize(f.ctx, t, f.appID, "v2", "2", 2000)
	seedBuildSize(f.ctx, t, f.appID, "v3", "3", 4000)

	size := func(t *testing.T, filterExpr string) *metrics.SizeMetric {
		t.Helper()
		flt := f.appHealthFilter(t, ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays, filterExpr)
		size, err := onboarded.GetSizeMetrics(f.ctx, deps.PgPool, deps.RchPool, flt)
		if err != nil {
			t.Fatalf("GetSizeMetrics: %v", err)
		}
		return size
	}

	t.Run("one selected version is compared against the rest", func(t *testing.T) {
		got := size(t, "version_name:in:v1 AND version_code:in:1")
		if got == nil {
			t.Fatal("want a size for a single selected version")
		}
		// v2 and v3 average 3000.
		if got.SelectedAppSize != 1000 || got.AverageAppSize != 3000 || got.Delta != -2000 {
			t.Errorf("size = %+v, want 1000 against an average of 3000", got)
		}
	})

	t.Run("more than one selected version name has no size", func(t *testing.T) {
		if got := size(t, "version_name:in:[v1,v2]"); got != nil {
			t.Errorf("size = %+v, want none for two selected version names", got)
		}
	})

	t.Run("a version name with several builds reports its most recent build", func(t *testing.T) {
		seedEventRows(f.ctx, t, team, app, 1, testinfra.EventRow{AppVersion: "v1", AppBuild: "2", Timestamp: ts.Add(30 * time.Minute)})
		seedBuildSize(f.ctx, t, f.appID, "v1", "2", 1500)

		got := size(t, "version_name:in:v1")
		if got == nil {
			t.Fatal("want a size for a single selected version name")
		}
		// The older v1 build joins v2 and v3 in the average: (1000 + 2000 + 4000) / 3.
		if got.SelectedAppSize != 1500 || got.AverageAppSize != 2333 || got.Delta != -833 {
			t.Errorf("size = %+v, want 1500 against an average of 2333", got)
		}
	})

	t.Run("no filter expression has no size", func(t *testing.T) {
		if got := size(t, ""); got != nil {
			t.Errorf("size = %+v, want none without a filter expression", got)
		}
	})

	t.Run("a version with no rows has no size", func(t *testing.T) {
		if got := size(t, "version_name:in:v9"); got != nil {
			t.Errorf("size = %+v, want none for an unknown version", got)
		}
	})
}
