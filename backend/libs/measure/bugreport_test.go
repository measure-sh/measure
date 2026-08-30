//go:build integration

package measure

import (
	"context"
	"testing"
	"time"

	"backend/libs/exprfilter"
	"backend/testinfra"

	"github.com/google/uuid"
)

type bugReportFixture struct {
	spanFixture
	openEventID     uuid.UUID
	openSessionID   uuid.UUID
	closedEventID   uuid.UUID
	closedSessionID uuid.UUID
}

// newBugReportFixture seeds two bug reports for one app: an open report from
// alice on version v1 on an Android Google Pixel, and ten minutes later a
// closed report from bob on version v2 on an iOS Apple iPhone. A report of
// another app is seeded too, which every query must leave out.
func newBugReportFixture(t *testing.T) (bugReportFixture, time.Time) {
	t.Helper()

	f := bugReportFixture{
		openEventID:     uuid.New(),
		openSessionID:   uuid.New(),
		closedEventID:   uuid.New(),
		closedSessionID: uuid.New(),
	}

	ctx := context.Background()
	cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	otherAppID := uuid.New()
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
		EventID:            f.openEventID.String(),
		SessionID:          f.openSessionID.String(),
		Status:             0,
		Description:        "checkout button does nothing",
		Timestamp:          base,
		AppVersion:         "v1",
		AppBuild:           "1",
		UserID:             "alice",
		DeviceManufacturer: "Google",
		DeviceName:         "pixel 4a",
	})
	th.SeedBugReportRow(ctx, t, teamID.String(), appID.String(), testinfra.BugReportRow{
		EventID:            f.closedEventID.String(),
		SessionID:          f.closedSessionID.String(),
		Status:             1,
		Description:        "app freezes on login",
		Timestamp:          base.Add(10 * time.Minute),
		AppVersion:         "v2",
		AppBuild:           "2",
		OSName:             "iOS",
		OSVersion:          "17.4",
		UserID:             "bob",
		DeviceManufacturer: "Apple",
		DeviceName:         "iPhone 15",
	})
	th.SeedBugReportRow(ctx, t, teamID.String(), otherAppID.String(), testinfra.BugReportRow{
		Timestamp:   base,
		Description: "another app report",
	})

	f.spanFixture = spanFixture{
		ctx:    ctx,
		teamID: teamID,
		appID:  appID,
		app:    App{ID: &appID, TeamId: teamID},
	}
	return f, base
}

func (f bugReportFixture) exprFilter(from, to time.Time, exprTree *exprfilter.ExprTree) *exprfilter.ExprFilter {
	ef := f.spanFixture.exprFilter(from, to, exprTree)
	ef.Entity = exprfilter.BugReportsEntity
	return ef
}

func bugReportVersions(t *testing.T, ef *exprfilter.ExprFilter, f bugReportFixture) []string {
	t.Helper()
	bugReports, _, _, err := f.app.GetBugReportsWithFilter(f.ctx, deps.RchPool, ef)
	if err != nil {
		t.Fatalf("GetBugReportsWithFilter: %v", err)
	}
	versions := make([]string, len(bugReports))
	for i, bugReport := range bugReports {
		versions[i] = bugReport.Attribute.AppVersion
	}
	return versions
}

func TestGetBugReportsWithFilter(t *testing.T) {
	f, base := newBugReportFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	t.Run("no filter returns the app's reports newest first", func(t *testing.T) {
		got := bugReportVersions(t, f.exprFilter(from, to, nil), f)
		if len(got) != 2 || got[0] != "v2" || got[1] != "v1" {
			t.Fatalf("want [v2 v1], got %v", got)
		}
	})

	t.Run("status filter translates names to codes", func(t *testing.T) {
		exprTree := leaf("bug_report_status", exprfilter.OperatorIn, "open")
		got := bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want the open report [v1], got %v", got)
		}

		exprTree = leaf("bug_report_status", exprfilter.OperatorIn, "closed")
		got = bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want the closed report [v2], got %v", got)
		}

		exprTree = leaf("bug_report_status", exprfilter.OperatorIn, "open", "closed")
		got = bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 2 {
			t.Fatalf("want both reports, got %v", got)
		}
	})

	t.Run("version filter", func(t *testing.T) {
		exprTree := leaf("version_name", exprfilter.OperatorIn, "v1")
		got := bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}
	})

	t.Run("os name filter reads the version tuple", func(t *testing.T) {
		exprTree := leaf("os_name", exprfilter.OperatorIn, "iOS")
		got := bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want [v2], got %v", got)
		}
	})

	t.Run("description substring match", func(t *testing.T) {
		exprTree := leaf("bug_report_description", exprfilter.OperatorContains, "freezes")
		got := bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want [v2], got %v", got)
		}

		exprTree = leaf("bug_report_description", exprfilter.OperatorNotContains, "freezes")
		got = bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}
	})

	t.Run("user id filter", func(t *testing.T) {
		exprTree := leaf("user_id", exprfilter.OperatorIn, "alice")
		got := bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}
	})

	t.Run("session id filter binds the uuid column", func(t *testing.T) {
		exprTree := leaf("session_id", exprfilter.OperatorIn, f.openSessionID.String())
		got := bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}

		exprTree = leaf("session_id", exprfilter.OperatorNotIn, f.openSessionID.String())
		got = bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want [v2], got %v", got)
		}
	})

	t.Run("or group matches either side", func(t *testing.T) {
		exprTree := exprfilter.ExprTree{LogicalOperator: exprfilter.LogicalOr, Children: []exprfilter.ExprTree{
			leaf("user_id", exprfilter.OperatorIn, "alice"),
			leaf("bug_report_status", exprfilter.OperatorIn, "closed"),
		}}
		got := bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 2 {
			t.Fatalf("want both reports, got %v", got)
		}
	})

	t.Run("a filter matching nothing", func(t *testing.T) {
		exprTree := leaf("network_type", exprfilter.OperatorIn, "vpn")
		got := bugReportVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 0 {
			t.Fatalf("want no reports, got %v", got)
		}
	})

	t.Run("pagination flags", func(t *testing.T) {
		ef := f.exprFilter(from, to, nil)
		ef.Limit = 1

		bugReports, next, previous, err := f.app.GetBugReportsWithFilter(f.ctx, deps.RchPool, ef)
		if err != nil {
			t.Fatalf("GetBugReportsWithFilter: %v", err)
		}
		if len(bugReports) != 1 || !next || previous {
			t.Fatalf("want the first page with more to come, got %d reports next=%v previous=%v", len(bugReports), next, previous)
		}

		ef.Offset = 1
		bugReports, next, previous, err = f.app.GetBugReportsWithFilter(f.ctx, deps.RchPool, ef)
		if err != nil {
			t.Fatalf("GetBugReportsWithFilter: %v", err)
		}
		if len(bugReports) != 1 || next || !previous {
			t.Fatalf("want the last page with one before it, got %d reports next=%v previous=%v", len(bugReports), next, previous)
		}
	})
}

func bugReportPlotVersions(t *testing.T, ef *exprfilter.ExprFilter, f bugReportFixture) map[string]bool {
	t.Helper()
	items, err := f.app.GetBugReportInstancesPlot(f.ctx, deps.RchPool, ef)
	if err != nil {
		t.Fatalf("GetBugReportInstancesPlot: %v", err)
	}
	versions := map[string]bool{}
	for _, item := range items {
		versions[item.Version] = true
	}
	return versions
}

func TestGetBugReportInstancesPlotWithExprFilter(t *testing.T) {
	f, base := newBugReportFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	plot := func(t *testing.T, exprTree *exprfilter.ExprTree, plotTimeGroup string) map[string]bool {
		t.Helper()
		ef := f.exprFilter(from, to, exprTree)
		ef.PlotTimeGroup = plotTimeGroup
		return bugReportPlotVersions(t, ef, f)
	}

	t.Run("no filter returns one series per version", func(t *testing.T) {
		got := plot(t, nil, exprfilter.PlotTimeGroupDays)
		if len(got) != 2 || !got["v1 (1)"] || !got["v2 (2)"] {
			t.Fatalf("want v1 (1) and v2 (2), got %v", got)
		}
	})

	t.Run("status filter translates names to codes", func(t *testing.T) {
		exprTree := leaf("bug_report_status", exprfilter.OperatorIn, "open")
		got := plot(t, &exprTree, exprfilter.PlotTimeGroupDays)
		if len(got) != 1 || !got["v1 (1)"] {
			t.Fatalf("want only v1 (1), got %v", got)
		}
	})

	t.Run("an empty plot time group defaults to days", func(t *testing.T) {
		got := plot(t, nil, "")
		if len(got) != 2 {
			t.Fatalf("want both versions, got %v", got)
		}
	})

	t.Run("missing timezone returns an error", func(t *testing.T) {
		ef := f.exprFilter(from, to, nil)
		ef.Timezone = ""
		if _, err := f.app.GetBugReportInstancesPlot(f.ctx, deps.RchPool, ef); err == nil {
			t.Fatal("want an error for a missing timezone")
		}
	})

	t.Run("unsupported plot time group returns an error", func(t *testing.T) {
		ef := f.exprFilter(from, to, nil)
		ef.PlotTimeGroup = "weeks"
		if _, err := f.app.GetBugReportInstancesPlot(f.ctx, deps.RchPool, ef); err == nil {
			t.Fatal("want an error for an unsupported plot time group")
		}
	})
}

func TestGetBugReportsWithCustomKeys(t *testing.T) {
	f, base := newBugReportFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	th.SeedUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.UDAttrRow{
		EventID: f.openEventID.String(), BugReport: true,
		Key: "plan", Value: "pro", Timestamp: base,
	})
	th.SeedUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.UDAttrRow{
		EventID: f.closedEventID.String(), BugReport: true,
		Key: "plan", Value: "free", AppVersion: "v2", AppBuild: "2", Timestamp: base.Add(10 * time.Minute),
	})
	th.SeedUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.UDAttrRow{
		EventID: f.openEventID.String(), BugReport: true,
		Key: "retries", Type: "int64", Value: "9", Timestamp: base,
	})
	// A session attribute on the closed report's event with the same key and
	// value as the open report's. Its row is not flagged bug_report, so it
	// must never pull the closed report into a result.
	th.SeedUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.UDAttrRow{
		EventID: f.closedEventID.String(), BugReport: false,
		Key: "plan", Value: "pro", AppVersion: "v2", AppBuild: "2", Timestamp: base.Add(10 * time.Minute),
	})

	listVersions := func(t *testing.T, exprTree exprfilter.ExprTree) []string {
		t.Helper()
		ef := f.exprFilter(from, to, &exprTree)
		resolveCustomKeys(t, ef)
		return bugReportVersions(t, ef, f)
	}

	t.Run("string value narrows to its report", func(t *testing.T) {
		got := listVersions(t, leaf("custom.plan", exprfilter.OperatorIn, "free"))
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want [v2], got %v", got)
		}
	})

	t.Run("a non-bug-report attribute row does not leak in", func(t *testing.T) {
		got := listVersions(t, leaf("custom.plan", exprfilter.OperatorIn, "pro"))
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want only the open report [v1], got %v", got)
		}
	})

	t.Run("numbers compare as numbers", func(t *testing.T) {
		got := listVersions(t, leaf("custom.retries", exprfilter.OperatorGt, "5"))
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}
	})

	t.Run("is_not_set matches reports without the attribute", func(t *testing.T) {
		got := listVersions(t, leaf("custom.retries", exprfilter.OperatorIsNotSet))
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want [v2], got %v", got)
		}
	})

	t.Run("a custom key beside a built-in key", func(t *testing.T) {
		got := listVersions(t, exprfilter.ExprTree{LogicalOperator: exprfilter.LogicalAnd, Children: []exprfilter.ExprTree{
			leaf("custom.plan", exprfilter.OperatorIn, "pro", "free"),
			leaf("bug_report_status", exprfilter.OperatorIn, "closed"),
		}})
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want [v2], got %v", got)
		}
	})

	t.Run("two custom conditions under and share one scan", func(t *testing.T) {
		got := listVersions(t, exprfilter.ExprTree{LogicalOperator: exprfilter.LogicalAnd, Children: []exprfilter.ExprTree{
			leaf("custom.plan", exprfilter.OperatorIn, "pro"),
			leaf("custom.retries", exprfilter.OperatorGt, "5"),
		}})
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}
	})

	t.Run("the plot narrows by the same membership", func(t *testing.T) {
		exprTree := leaf("custom.plan", exprfilter.OperatorIn, "pro")
		ef := f.exprFilter(from, to, &exprTree)
		ef.PlotTimeGroup = exprfilter.PlotTimeGroupDays
		resolveCustomKeys(t, ef)
		got := bugReportPlotVersions(t, ef, f)
		if len(got) != 1 || !got["v1 (1)"] {
			t.Fatalf("want only v1 (1), got %v", got)
		}
	})
}
