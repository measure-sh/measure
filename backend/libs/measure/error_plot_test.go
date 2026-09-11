//go:build integration

package measure

import (
	"testing"
	"time"

	"backend/libs/event"
	"backend/libs/filter"
	"backend/testinfra"
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

// --------------------------------------------------------------------------
// GetErrorPlotInstances: overview plot
// --------------------------------------------------------------------------

func TestGetErrorPlotInstancesCountsEveryErrorKind(t *testing.T) {
	f := newErrorKindsFixture(t)

	total := func(t *testing.T, exprTree *filter.ExprTree) uint64 {
		t.Helper()
		items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, f.newFilter(exprTree))
		if err != nil {
			t.Fatalf("GetErrorPlotInstances: %v", err)
		}
		return sumIssueInstances(items)
	}

	t.Run("no filter counts every error of the app", func(t *testing.T) {
		if got := total(t, nil); got != 7 {
			t.Fatalf("instances = %d, want 7", got)
		}
	})

	tests := []struct {
		name      string
		exprTree  filter.ExprTree
		wantTotal uint64
	}{
		{"a crash covers the severity and the legacy unhandled row", leaf("error_type", filter.OperatorIn, filter.ErrorTypeCrash), 3},
		{"an anr", leaf("error_type", filter.OperatorIn, filter.ErrorTypeANR), 1},
		{"a handled error covers the legacy handled row", leaf("error_type", filter.OperatorIn, filter.ErrorTypeHandledError), 2},
		{"an unhandled error needs a named severity", leaf("error_type", filter.OperatorIn, filter.ErrorTypeUnhandledError), 1},
		{"not an anr", leaf("error_type", filter.OperatorNotIn, filter.ErrorTypeANR), 6},
		{"one version", leaf("version_name", filter.OperatorIn, "1.2.0"), 1},
		{"one user", leaf("user_id", filter.OperatorIn, "ana"), 2},
		{"one patch", leaf("patch_version", filter.OperatorIn, "1.2.0-patch.3"), 1},
		{"one os", leaf("os_name", filter.OperatorIn, "android"), 6},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			exprTree := test.exprTree
			if got := total(t, &exprTree); got != test.wantTotal {
				t.Fatalf("instances = %d, want %d", got, test.wantTotal)
			}
		})
	}

	t.Run("an error kind and an os name together", func(t *testing.T) {
		exprTree := filter.ExprTree{LogicalOperator: filter.LogicalAnd, Children: []filter.ExprTree{
			leaf("error_type", filter.OperatorIn, filter.ErrorTypeCrash),
			leaf("os_name", filter.OperatorIn, "android"),
		}}
		if got := total(t, &exprTree); got != 2 {
			t.Fatalf("instances = %d, want 2", got)
		}
	})
}

func TestGetErrorPlotInstancesMissingTimezone(t *testing.T) {
	f := newPlotFixture(t)
	now := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	flt := f.errorFilter(now.Add(-time.Hour), now.Add(time.Hour), "", filter.PlotTimeGroupDays)
	if _, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, flt); err == nil {
		t.Fatal("expected error for missing timezone")
	}
}

func TestGetErrorPlotInstancesEmptyWhenNoMatchingData(t *testing.T) {
	f := newPlotFixture(t)
	now := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	flt := f.errorFilter(now.Add(-time.Hour), now.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, flt)
	if err != nil {
		t.Fatalf("GetErrorPlotInstances: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected empty result, got %d rows", len(items))
	}
}

// --------------------------------------------------------------------------
// GetErrorGroupPlotInstances: detail plot, fingerprint-scoped
// --------------------------------------------------------------------------

func TestGetErrorGroupPlotInstancesScopesToTheFingerprint(t *testing.T) {
	f := newErrorKindsFixture(t)

	total := func(t *testing.T, fingerprint string, exprTree *filter.ExprTree) uint64 {
		t.Helper()
		items, err := f.app.GetErrorGroupPlotInstances(f.ctx, deps.RchPool, fingerprint, f.newFilter(exprTree))
		if err != nil {
			t.Fatalf("GetErrorGroupPlotInstances: %v", err)
		}
		return sumIssueInstances(items)
	}

	crash := leaf("error_type", filter.OperatorIn, filter.ErrorTypeCrash)
	anr := leaf("error_type", filter.OperatorIn, filter.ErrorTypeANR)

	tests := []struct {
		name        string
		fingerprint string
		exprTree    *filter.ExprTree
		wantTotal   uint64
	}{
		{"an exception fingerprint with no filter", fpCrash, nil, 1},
		{"an anr fingerprint with no filter", fpANR, nil, 1},
		{"a crash filter on a crash fingerprint", fpCrash, &crash, 1},
		{"a crash filter on a handled fingerprint", fpHandled, &crash, 0},
		{"an anr filter on an exception fingerprint", fpCrash, &anr, 0},
		{"an anr filter on an anr fingerprint", fpANR, &anr, 1},
		{"an unknown fingerprint", "ffffffffffffffffffffffffffffffff", nil, 0},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := total(t, test.fingerprint, test.exprTree); got != test.wantTotal {
				t.Fatalf("instances = %d, want %d", got, test.wantTotal)
			}
		})
	}
}

func TestGetErrorGroupPlotInstancesMissingTimezone(t *testing.T) {
	f := newPlotFixture(t)
	now := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	flt := f.errorFilter(now.Add(-time.Hour), now.Add(time.Hour), "", filter.PlotTimeGroupDays)
	if _, err := f.app.GetErrorGroupPlotInstances(f.ctx, deps.RchPool, fpCrash, flt); err == nil {
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

	flt := f.errorFilter(t1.Add(-time.Hour), t3.Add(time.Hour), "UTC", "")

	items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, flt)
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

	flt := f.errorFilter(t1.Add(-time.Hour), t2.Add(time.Hour), "UTC", "")

	items, err := f.app.GetErrorGroupPlotInstances(f.ctx, deps.RchPool, fp, flt)
	if err != nil {
		t.Fatalf("GetErrorGroupPlotInstances: %v", err)
	}
	assertBucketCounts(t, issueBucketCounts(items), expectedCounts([]time.Time{t1, t2}, filter.PlotTimeGroupDays, false))
}

func TestGetErrorPlotInstancesRespectsTimezoneBucketing(t *testing.T) {
	f := newPlotFixture(t)

	// 2026-01-05T23:30Z becomes 2026-01-06 in Asia/Kolkata (+05:30).
	ts := time.Date(2026, 1, 5, 23, 30, 0, 0, time.UTC)
	seedIssueEvent(f.ctx, t, f.teamIDStr(), f.appIDStr(), "exception", "", false, ts)

	flt := f.errorFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "Asia/Kolkata", filter.PlotTimeGroupDays)
	items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, flt)
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

func TestGetErrorPlotInstancesGroupsByVersion(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	seedEventRows(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, testinfra.EventRow{
		Type: "exception", Timestamp: ts, AppVersion: "v1", AppBuild: "1",
	})
	seedEventRows(f.ctx, t, f.teamIDStr(), f.appIDStr(), 1, testinfra.EventRow{
		Type: "exception", Timestamp: ts, AppVersion: "v2", AppBuild: "2",
	})

	flt := f.errorFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	exprTree := leaf("version_name", filter.OperatorIn, "v1")
	flt.ExprTree = &exprTree

	items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, flt)
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

// --------------------------------------------------------------------------
// GetErrorGroupAttributesDistribution
// --------------------------------------------------------------------------

func TestGetErrorGroupAttributesDistribution(t *testing.T) {
	f := newErrorKindsFixture(t)

	t.Run("an anr fingerprint reads the anr's attributes", func(t *testing.T) {
		distribution, err := f.app.GetErrorGroupAttributesDistribution(f.ctx, deps.RchPool, fpANR, f.newFilter(nil))
		if err != nil {
			t.Fatalf("GetErrorGroupAttributesDistribution: %v", err)
		}
		if got := distribution.Country["US"]; got != 1 {
			t.Errorf("country US = %d, want 1", got)
		}
		if got := distribution.AppVersion["1.1.0 (110)"]; got != 1 {
			t.Errorf("app version 1.1.0 (110) = %d, want 1", got)
		}
	})

	t.Run("a filter the error does not match empties the distribution", func(t *testing.T) {
		exprTree := leaf("os_name", filter.OperatorIn, "ios")
		distribution, err := f.app.GetErrorGroupAttributesDistribution(f.ctx, deps.RchPool, fpANR, f.newFilter(&exprTree))
		if err != nil {
			t.Fatalf("GetErrorGroupAttributesDistribution: %v", err)
		}
		if len(distribution.Country) != 0 {
			t.Errorf("want no countries, got %v", distribution.Country)
		}
	})
}

// --------------------------------------------------------------------------
// GetErrorsWithFilter
// --------------------------------------------------------------------------

func TestGetErrorsWithFilter(t *testing.T) {
	f := newErrorKindsFixture(t)

	count := func(t *testing.T, fingerprint string, exprTree *filter.ExprTree) int {
		t.Helper()
		events, _, _, err := f.app.GetErrorsWithFilter(f.ctx, deps.RchPool, fingerprint, f.newFilter(exprTree))
		if err != nil {
			t.Fatalf("GetErrorsWithFilter: %v", err)
		}
		return len(events)
	}

	t.Run("an exception fingerprint returns its event", func(t *testing.T) {
		if got := count(t, fpCrash, nil); got != 1 {
			t.Fatalf("want 1 event, got %d", got)
		}
	})

	t.Run("an anr fingerprint returns its event", func(t *testing.T) {
		if got := count(t, fpANR, nil); got != 1 {
			t.Fatalf("want 1 event, got %d", got)
		}
	})

	t.Run("a filter the event does not match returns nothing", func(t *testing.T) {
		exprTree := leaf("os_name", filter.OperatorIn, "ios")
		if got := count(t, fpCrash, &exprTree); got != 0 {
			t.Fatalf("want no events, got %d", got)
		}
	})

	t.Run("an error kind filter reaches the anr query too", func(t *testing.T) {
		exprTree := leaf("error_type", filter.OperatorIn, filter.ErrorTypeCrash)
		if got := count(t, fpANR, &exprTree); got != 0 {
			t.Fatalf("want no events, got %d", got)
		}
	})

	t.Run("an unknown fingerprint returns nothing", func(t *testing.T) {
		if got := count(t, "ffffffffffffffffffffffffffffffff", nil); got != 0 {
			t.Fatalf("want no events, got %d", got)
		}
	})
}
