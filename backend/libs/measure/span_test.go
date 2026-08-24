//go:build integration

package measure

import (
	"context"
	"strings"
	"testing"
	"time"

	"backend/libs/exprfilter"
	"backend/testinfra"

	"github.com/google/uuid"
)

type spanFixture struct {
	ctx    context.Context
	teamID uuid.UUID
	appID  uuid.UUID
	app    App
}

// newSpanFixture seeds two http_request spans for one app: version v1 on
// an Android Google Pixel with an ok status, and ten minutes later version v2
// on an iOS Apple iPhone with an error status. A span of another name and a
// span of another app are seeded too, which every query must leave out.
func newSpanFixture(t *testing.T) (spanFixture, time.Time) {
	t.Helper()

	ctx := context.Background()
	cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	otherAppID := uuid.New()
	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

	th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
		SpanName:           "http_request",
		Status:             1,
		StartTime:          base,
		AppVersion:         "v1",
		AppBuild:           "1",
		OSName:             "Android",
		OSVersion:          "14",
		CountryCode:        "US",
		NetworkType:        "wifi",
		DeviceManufacturer: "Google",
		DeviceName:         "pixel 4a",
	})
	th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
		SpanName:           "http_request",
		Status:             2,
		StartTime:          base.Add(10 * time.Minute),
		AppVersion:         "v2",
		AppBuild:           "2",
		OSName:             "iOS",
		OSVersion:          "17.4",
		CountryCode:        "IN",
		NetworkType:        "cellular",
		DeviceManufacturer: "Apple",
		DeviceName:         "iPhone 15",
	})
	th.SeedSpanRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.SpanRow{
		SpanName:  "db_query",
		Status:    1,
		StartTime: base,
	})
	th.SeedSpanRows(ctx, t, teamID.String(), otherAppID.String(), 1, testinfra.SpanRow{
		SpanName:  "http_request",
		Status:    1,
		StartTime: base,
	})

	return spanFixture{
		ctx:    ctx,
		teamID: teamID,
		appID:  appID,
		app:    App{ID: &appID, TeamId: teamID},
	}, base
}

func (f spanFixture) exprFilter(from, to time.Time, exprTree *exprfilter.ExprTree) *exprfilter.ExprFilter {
	return &exprfilter.ExprFilter{
		AppID:    f.appID,
		TeamID:   f.teamID,
		Entity:   exprfilter.SpansEntity,
		From:     from,
		To:       to,
		Timezone: "UTC",
		Limit:    10,
		ExprTree: exprTree,
	}
}

func spanVersions(t *testing.T, ef *exprfilter.ExprFilter, f spanFixture) []string {
	t.Helper()
	spans, _, _, err := f.app.GetSpansForSpanNameWithFilter(f.ctx, deps.RchPool, "http_request", ef)
	if err != nil {
		t.Fatalf("GetSpansForSpanNameWithFilter: %v", err)
	}
	versions := make([]string, len(spans))
	for i, s := range spans {
		versions[i] = s.AppVersion
	}
	return versions
}

func TestGetSpansForSpanNameWithFilter(t *testing.T) {
	f, base := newSpanFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	t.Run("no filter returns the named spans newest first", func(t *testing.T) {
		ef := f.exprFilter(from, to, nil)
		got := spanVersions(t, ef, f)
		if len(got) != 2 || got[0] != "v2" || got[1] != "v1" {
			t.Fatalf("want [v2 v1], got %v", got)
		}
	})

	t.Run("version filter", func(t *testing.T) {
		exprTree := leaf("version_name", exprfilter.OperatorIn, "v1")
		got := spanVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}
	})

	t.Run("status filter translates names to codes", func(t *testing.T) {
		exprTree := leaf("span_status", exprfilter.OperatorIn, "error")
		got := spanVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want [v2], got %v", got)
		}
	})

	t.Run("os name filter reads the version tuple", func(t *testing.T) {
		exprTree := leaf("os_name", exprfilter.OperatorIn, "iOS")
		got := spanVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want [v2], got %v", got)
		}
	})

	t.Run("device name substring match", func(t *testing.T) {
		exprTree := leaf("device_name", exprfilter.OperatorContains, "phone")
		got := spanVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want [v2], got %v", got)
		}
	})

	t.Run("or group matches either side", func(t *testing.T) {
		exprTree := exprfilter.ExprTree{LogicalOperator: exprfilter.LogicalOr, Children: []exprfilter.ExprTree{
			leaf("version_name", exprfilter.OperatorIn, "v1"),
			leaf("span_status", exprfilter.OperatorIn, "error"),
		}}
		got := spanVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 2 {
			t.Fatalf("want both spans, got %v", got)
		}
	})

	t.Run("a filter matching nothing", func(t *testing.T) {
		exprTree := leaf("network_type", exprfilter.OperatorIn, "vpn")
		got := spanVersions(t, f.exprFilter(from, to, &exprTree), f)
		if len(got) != 0 {
			t.Fatalf("want no spans, got %v", got)
		}
	})

	t.Run("pagination flags", func(t *testing.T) {
		ef := f.exprFilter(from, to, nil)
		ef.Limit = 1

		spans, next, previous, err := f.app.GetSpansForSpanNameWithFilter(f.ctx, deps.RchPool, "http_request", ef)
		if err != nil {
			t.Fatalf("GetSpansForSpanNameWithFilter: %v", err)
		}
		if len(spans) != 1 || !next || previous {
			t.Fatalf("want the first page with more to come, got %d spans next=%v previous=%v", len(spans), next, previous)
		}

		ef.Offset = 1
		spans, next, previous, err = f.app.GetSpansForSpanNameWithFilter(f.ctx, deps.RchPool, "http_request", ef)
		if err != nil {
			t.Fatalf("GetSpansForSpanNameWithFilter: %v", err)
		}
		if len(spans) != 1 || next || !previous {
			t.Fatalf("want the last page with one before it, got %d spans next=%v previous=%v", len(spans), next, previous)
		}
	})
}

func metricsVersions(t *testing.T, ef *exprfilter.ExprFilter, f spanFixture, plotTimeGroup string) map[string]bool {
	t.Helper()
	ef.PlotTimeGroup = plotTimeGroup
	items, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, deps.RchPool, "http_request", ef)
	if err != nil {
		t.Fatalf("GetMetricsPlotForSpanNameWithFilter: %v", err)
	}
	versions := map[string]bool{}
	for _, item := range items {
		versions[item.Version] = true
	}
	return versions
}

func TestGetMetricsPlotForSpanNameWithFilter(t *testing.T) {
	f, base := newSpanFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	t.Run("no filter returns one row per version", func(t *testing.T) {
		got := metricsVersions(t, f.exprFilter(from, to, nil), f, exprfilter.PlotTimeGroupDays)
		if len(got) != 2 || !got["v1 (1)"] || !got["v2 (2)"] {
			t.Fatalf("want v1 (1) and v2 (2), got %v", got)
		}
	})

	t.Run("device name filter binds the rollup's flat column", func(t *testing.T) {
		exprTree := leaf("device_name", exprfilter.OperatorIn, "pixel 4a")
		got := metricsVersions(t, f.exprFilter(from, to, &exprTree), f, exprfilter.PlotTimeGroupDays)
		if len(got) != 1 || !got["v1 (1)"] {
			t.Fatalf("want only v1 (1), got %v", got)
		}
	})

	t.Run("os name filter reads the rollup's version tuple", func(t *testing.T) {
		exprTree := leaf("os_name", exprfilter.OperatorIn, "iOS")
		got := metricsVersions(t, f.exprFilter(from, to, &exprTree), f, exprfilter.PlotTimeGroupDays)
		if len(got) != 1 || !got["v2 (2)"] {
			t.Fatalf("want only v2 (2), got %v", got)
		}
	})

	t.Run("status filter translates names to codes", func(t *testing.T) {
		exprTree := leaf("span_status", exprfilter.OperatorIn, "error")
		got := metricsVersions(t, f.exprFilter(from, to, &exprTree), f, exprfilter.PlotTimeGroupDays)
		if len(got) != 1 || !got["v2 (2)"] {
			t.Fatalf("want only v2 (2), got %v", got)
		}
	})

	t.Run("an empty plot time group defaults to days", func(t *testing.T) {
		got := metricsVersions(t, f.exprFilter(from, to, nil), f, "")
		if len(got) != 2 {
			t.Fatalf("want both versions, got %v", got)
		}
	})

	t.Run("missing timezone returns an error", func(t *testing.T) {
		ef := f.exprFilter(from, to, nil)
		ef.Timezone = ""
		ef.PlotTimeGroup = exprfilter.PlotTimeGroupDays
		if _, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, deps.RchPool, "http_request", ef); err == nil {
			t.Fatal("want an error for a missing timezone")
		}
	})

	t.Run("unsupported plot time group returns an error", func(t *testing.T) {
		ef := f.exprFilter(from, to, nil)
		ef.PlotTimeGroup = "weeks"
		if _, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, deps.RchPool, "http_request", ef); err == nil {
			t.Fatal("want an error for an unsupported plot time group")
		}
	})
}

func newCustomKeySpanFixture(t *testing.T) (spanFixture, time.Time) {
	t.Helper()

	f, base := newSpanFixture(t)
	spanOne, spanTwo := "1111111111111111", "2222222222222222"

	th.SeedSpanRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.SpanRow{
		SpanName:   "http_request",
		SpanID:     spanOne,
		StartTime:  base,
		AppVersion: "v1",
		AppBuild:   "1",
	})
	th.SeedSpanRows(f.ctx, t, f.teamID.String(), f.appID.String(), 1, testinfra.SpanRow{
		SpanName:   "http_request",
		SpanID:     spanTwo,
		StartTime:  base.Add(10 * time.Minute),
		AppVersion: "v2",
		AppBuild:   "2",
	})

	th.SeedSpanUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.SpanUDAttrRow{SpanID: spanOne, Key: "plan", Value: "pro", Timestamp: base})
	th.SeedSpanUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.SpanUDAttrRow{SpanID: spanOne, Key: "retries", Type: "int64", Value: "9", Timestamp: base})
	th.SeedSpanUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.SpanUDAttrRow{SpanID: spanOne, Key: "is_premium", Type: "bool", Value: "true", Timestamp: base})
	th.SeedSpanUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.SpanUDAttrRow{SpanID: spanOne, Key: "coupon", Value: "WELCOME", Timestamp: base})
	th.SeedSpanUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.SpanUDAttrRow{SpanID: spanTwo, Key: "plan", Value: "free", Timestamp: base.Add(10 * time.Minute)})
	th.SeedSpanUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.SpanUDAttrRow{SpanID: spanTwo, Key: "retries", Type: "int64", Value: "10", Timestamp: base.Add(10 * time.Minute)})
	// The badge attribute changes type over time: the older row is a string,
	// the newer a bool, so the key resolves as bool.
	th.SeedSpanUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.SpanUDAttrRow{SpanID: spanOne, Key: "badge", Value: "gold", Timestamp: base})
	th.SeedSpanUDAttrRow(f.ctx, t, f.teamID.String(), f.appID.String(), testinfra.SpanUDAttrRow{SpanID: spanTwo, Key: "badge", Type: "bool", Value: "true", Timestamp: base.Add(10 * time.Minute)})

	return f, base
}

// resolveCustomKeys runs the same steps a handler does for a filter that may
// mention user-defined attribute keys: read the mentioned keys, then validate
// against the widened key set.
func resolveCustomKeys(t *testing.T, ef *exprfilter.ExprFilter) {
	t.Helper()
	if err := ef.ResolveCustomKeys(context.Background(), deps.RchPool); err != nil {
		t.Fatalf("ResolveCustomKeys: %v", err)
	}
	if err := ef.Validate(); err != nil {
		t.Fatalf("Validate: %v", err)
	}
}

func TestGetSpansForSpanNameWithCustomKeys(t *testing.T) {
	f, base := newCustomKeySpanFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	// The unpinned spans of newSpanFixture carry no attributes, so a custom
	// condition matching both attributed spans still returns two of the four.
	listVersions := func(t *testing.T, exprTree exprfilter.ExprTree) []string {
		t.Helper()
		ef := f.exprFilter(from, to, &exprTree)
		resolveCustomKeys(t, ef)
		spans, _, _, err := f.app.GetSpansForSpanNameWithFilter(f.ctx, deps.RchPool, "http_request", ef)
		if err != nil {
			t.Fatalf("GetSpansForSpanNameWithFilter: %v", err)
		}
		versions := make([]string, len(spans))
		for i, s := range spans {
			versions[i] = s.AppVersion
		}
		return versions
	}

	t.Run("string value narrows to its span", func(t *testing.T) {
		got := listVersions(t, leaf("custom.plan", exprfilter.OperatorIn, "pro"))
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}
	})

	t.Run("a list of string values matches each", func(t *testing.T) {
		got := listVersions(t, leaf("custom.plan", exprfilter.OperatorIn, "pro", "free"))
		if len(got) != 2 {
			t.Fatalf("want both attributed spans, got %v", got)
		}
	})

	t.Run("numbers compare as numbers", func(t *testing.T) {
		// As text, "10" orders before "9"; the cast compares them as numbers.
		got := listVersions(t, leaf("custom.retries", exprfilter.OperatorGt, "9"))
		if len(got) != 1 || got[0] != "v2" {
			t.Fatalf("want [v2], got %v", got)
		}

		got = listVersions(t, leaf("custom.retries", exprfilter.OperatorGt, "5"))
		if len(got) != 2 {
			t.Fatalf("want both attributed spans, got %v", got)
		}
	})

	t.Run("bool value narrows to its span", func(t *testing.T) {
		got := listVersions(t, leaf("custom.is_premium", exprfilter.OperatorEq, "true"))
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}
	})

	t.Run("is_set matches spans carrying the attribute", func(t *testing.T) {
		got := listVersions(t, leaf("custom.coupon", exprfilter.OperatorIsSet))
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}
	})

	t.Run("is_not_set matches spans without the attribute", func(t *testing.T) {
		// Of the four http_request spans, only the attributed v1 span carries
		// the coupon attribute, so the other three remain: the attributed v2
		// span and the two unattributed spans of the base fixture.
		got := listVersions(t, leaf("custom.coupon", exprfilter.OperatorIsNotSet))
		if len(got) != 3 {
			t.Fatalf("want the three spans without the attribute, got %v", got)
		}
	})

	t.Run("not_in also matches spans without the attribute", func(t *testing.T) {
		// Of the four http_request spans, only the pro span is excluded: the
		// free span and the two unattributed spans of the base fixture stay,
		// like a fixed key's empty column value would.
		got := listVersions(t, leaf("custom.plan", exprfilter.OperatorNotIn, "pro"))
		if len(got) != 3 {
			t.Fatalf("want the three spans without plan pro, got %v", got)
		}
	})

	t.Run("is_set matches every type the attribute was written under", func(t *testing.T) {
		got := listVersions(t, leaf("custom.badge", exprfilter.OperatorIsSet))
		if len(got) != 2 {
			t.Fatalf("want the string-typed and bool-typed spans, got %v", got)
		}
	})

	t.Run("a custom key beside a built-in key", func(t *testing.T) {
		got := listVersions(t, exprfilter.ExprTree{LogicalOperator: exprfilter.LogicalAnd, Children: []exprfilter.ExprTree{
			leaf("custom.plan", exprfilter.OperatorIn, "pro"),
			leaf("version_name", exprfilter.OperatorIn, "v1"),
		}})
		if len(got) != 1 || got[0] != "v1" {
			t.Fatalf("want [v1], got %v", got)
		}

		got = listVersions(t, exprfilter.ExprTree{LogicalOperator: exprfilter.LogicalAnd, Children: []exprfilter.ExprTree{
			leaf("custom.plan", exprfilter.OperatorIn, "pro"),
			leaf("version_name", exprfilter.OperatorIn, "v2"),
		}})
		if len(got) != 0 {
			t.Fatalf("want no spans, got %v", got)
		}
	})

	t.Run("a custom key inside an or group", func(t *testing.T) {
		got := listVersions(t, exprfilter.ExprTree{LogicalOperator: exprfilter.LogicalOr, Children: []exprfilter.ExprTree{
			leaf("custom.plan", exprfilter.OperatorIn, "free"),
			leaf("version_name", exprfilter.OperatorIn, "v1"),
		}})
		if len(got) != 3 {
			t.Fatalf("want the free span and both v1 spans, got %v", got)
		}
	})

	t.Run("an unknown custom key fails validation", func(t *testing.T) {
		exprTree := leaf("custom.nope", exprfilter.OperatorIn, "x")
		ef := f.exprFilter(from, to, &exprTree)
		if err := ef.ResolveCustomKeys(context.Background(), deps.RchPool); err != nil {
			t.Fatalf("ResolveCustomKeys: %v", err)
		}
		err := ef.Validate()
		if err == nil {
			t.Fatal("want validation to refuse a key the app's spans never reported")
		}
		if !strings.Contains(err.Error(), "custom.nope") {
			t.Errorf("want the key named, got %q", err)
		}
	})
}

func TestGetMetricsPlotForSpanNameWithCustomKeys(t *testing.T) {
	f, base := newCustomKeySpanFixture(t)
	from, to := base.Add(-time.Hour), base.Add(time.Hour)

	plotVersions := func(t *testing.T, exprTree exprfilter.ExprTree) map[string]bool {
		t.Helper()
		ef := f.exprFilter(from, to, &exprTree)
		ef.PlotTimeGroup = exprfilter.PlotTimeGroupDays
		resolveCustomKeys(t, ef)
		items, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, deps.RchPool, "http_request", ef)
		if err != nil {
			t.Fatalf("GetMetricsPlotForSpanNameWithFilter: %v", err)
		}
		versions := map[string]bool{}
		for _, item := range items {
			versions[item.Version] = true
		}
		return versions
	}

	t.Run("an edge span keeps its attributes visible", func(t *testing.T) {
		// v2 starts 10 minutes after base, so it belongs to the 10:00 bucket.
		// The query ends 5 minutes after base, before v2's attributes end.
		// The v2 series should still be included because its bucket overlaps
		// the plot range.
		exprTree := leaf("custom.plan", exprfilter.OperatorIn, "free")
		ef := f.exprFilter(from, base.Add(5*time.Minute), &exprTree)
		ef.PlotTimeGroup = exprfilter.PlotTimeGroupDays
		resolveCustomKeys(t, ef)
		items, err := f.app.GetMetricsPlotForSpanNameWithFilter(f.ctx, deps.RchPool, "http_request", ef)
		if err != nil {
			t.Fatalf("GetMetricsPlotForSpanNameWithFilter: %v", err)
		}
		if len(items) != 1 || items[0].Version != "v2 (2)" {
			t.Fatalf("want the edge span's v2 (2) series, got %v", items)
		}
	})

	t.Run("string value narrows the rollup by span id", func(t *testing.T) {
		got := plotVersions(t, leaf("custom.plan", exprfilter.OperatorIn, "pro"))
		if len(got) != 1 || !got["v1 (1)"] {
			t.Fatalf("want only v1 (1), got %v", got)
		}
	})

	t.Run("numbers compare as numbers", func(t *testing.T) {
		got := plotVersions(t, leaf("custom.retries", exprfilter.OperatorGt, "9"))
		if len(got) != 1 || !got["v2 (2)"] {
			t.Fatalf("want only v2 (2), got %v", got)
		}
	})

	t.Run("a custom key beside a built-in key", func(t *testing.T) {
		got := plotVersions(t, exprfilter.ExprTree{LogicalOperator: exprfilter.LogicalAnd, Children: []exprfilter.ExprTree{
			leaf("custom.plan", exprfilter.OperatorIn, "free"),
			leaf("os_name", exprfilter.OperatorIn, "Android"),
		}})
		if len(got) != 1 || !got["v2 (2)"] {
			t.Fatalf("want only v2 (2), got %v", got)
		}
	})
}
