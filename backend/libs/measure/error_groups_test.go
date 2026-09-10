//go:build integration

package measure

import (
	"slices"
	"testing"
	"time"

	"backend/libs/event"
	"backend/libs/exprfilter"
	"backend/libs/group"
	"backend/testinfra"

	"github.com/google/uuid"
)

// 32-char fingerprints (events.exception.fingerprint and anr.fingerprint are
// FixedString(32)).
const (
	fpCrash         = "0000000000000000000000000000c001"
	fpANR           = "0000000000000000000000000000c002"
	fpHandled       = "0000000000000000000000000000c003"
	fpUnhandled     = "0000000000000000000000000000c004"
	fpLegacyCrash   = "0000000000000000000000000000c005"
	fpLegacyHandled = "0000000000000000000000000000c006"
	fpPatched       = "0000000000000000000000000000c007"
)

type errorKindsFixture struct {
	plotFixture
	ts         time.Time
	patchID    uuid.UUID
	crashEvent uuid.UUID
}

// newErrorKindsFixture seeds one event and its group row for every error
// kind: crash, ANR, handled, unhandled, the two legacy shapes with no
// severity, and a crash on a later version with an OTA patch.
func newErrorKindsFixture(t *testing.T) errorKindsFixture {
	t.Helper()

	f := errorKindsFixture{
		plotFixture: newPlotFixture(t),
		ts:          time.Now().UTC(),
		patchID:     uuid.New(),
		crashEvent:  uuid.New(),
	}
	teamID, appID := f.teamIDStr(), f.appIDStr()

	// Readers index into the exceptions list, so it must not be empty.
	const exceptionsJSON = `[{"type":"java.lang.RuntimeException","message":"Test error","frames":[]}]`

	android := func(row testinfra.EventRow) testinfra.EventRow {
		row.Timestamp = f.ts
		row.ExceptionsJSON = exceptionsJSON
		row.AppVersion = "1.1.0"
		row.AppBuild = "110"
		row.OSName = "android"
		row.OSVersion = "14"
		row.CountryCode = "US"
		row.NetworkProvider = "carrier"
		row.NetworkType = "wifi"
		row.NetworkGeneration = "4g"
		row.DeviceLocale = "en-US"
		row.DeviceManufacturer = "TestCo"
		row.DeviceName = "pixel"
		return row
	}

	seedGroup := func(table, fingerprint string, handled bool) {
		th.SeedGroupRow(f.ctx, t, teamID, appID, testinfra.GroupRow{
			Table: table, Fingerprint: fingerprint, AppVersion: "1.1.0", AppBuild: "110", Handled: handled,
		})
	}

	seedGroup("fatal_exception_groups", fpCrash, false)
	seedEventRows(f.ctx, t, teamID, appID, 1, android(testinfra.EventRow{
		Type: "exception", EventID: f.crashEvent.String(), Fingerprint: fpCrash,
		Severity: "fatal", UserID: "ana",
	}))

	seedGroup("anr_groups", fpANR, false)
	seedEventRows(f.ctx, t, teamID, appID, 1, android(testinfra.EventRow{
		Type: "anr", Fingerprint: fpANR, UserID: "zoe",
	}))

	seedGroup("nonfatal_exception_groups", fpHandled, true)
	seedEventRows(f.ctx, t, teamID, appID, 1, android(testinfra.EventRow{
		Type: "exception", Fingerprint: fpHandled, Severity: "handled",
	}))

	seedGroup("nonfatal_exception_groups", fpUnhandled, false)
	seedEventRows(f.ctx, t, teamID, appID, 1, android(testinfra.EventRow{
		Type: "exception", Fingerprint: fpUnhandled, Severity: "unhandled",
	}))

	seedGroup("fatal_exception_groups", fpLegacyCrash, false)
	seedEventRows(f.ctx, t, teamID, appID, 1, android(testinfra.EventRow{
		Type: "exception", Fingerprint: fpLegacyCrash, Handled: false,
	}))

	seedGroup("nonfatal_exception_groups", fpLegacyHandled, true)
	seedEventRows(f.ctx, t, teamID, appID, 1, android(testinfra.EventRow{
		Type: "exception", Fingerprint: fpLegacyHandled, Handled: true,
	}))

	th.SeedGroupRow(f.ctx, t, teamID, appID, testinfra.GroupRow{
		Table: "fatal_exception_groups", Fingerprint: fpPatched, AppVersion: "1.2.0", AppBuild: "120",
	})
	seedEventRows(f.ctx, t, teamID, appID, 1, testinfra.EventRow{
		Type: "exception", Fingerprint: fpPatched, Severity: "fatal",
		ExceptionsJSON: exceptionsJSON,
		Timestamp:      f.ts, AppVersion: "1.2.0", AppBuild: "120", UserID: "ana",
		OSName: "ios", OSVersion: "18", CountryCode: "IN",
		NetworkProvider: "carrier", NetworkType: "wifi", NetworkGeneration: "5g",
		DeviceLocale: "en-IN", DeviceManufacturer: "Apple", DeviceName: "iphone",
		PatchID: f.patchID, PatchVersion: "1.2.0-patch.3",
	})

	return f
}

func (f errorKindsFixture) filter(exprTree *exprfilter.ExprTree) *exprfilter.ExprFilter {
	ef := f.errorExprFilter(f.ts.Add(-time.Hour), f.ts.Add(time.Hour), "UTC", exprfilter.PlotTimeGroupDays)
	ef.ExprTree = exprTree
	return ef
}

// groupIDs returns the listed fingerprints, sorted.
func groupIDs(t *testing.T, f errorKindsFixture, ef *exprfilter.ExprFilter) []string {
	t.Helper()
	groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, ef)
	if err != nil {
		t.Fatalf("GetErrorGroupsWithFilter: %v", err)
	}
	ids := make([]string, len(groups))
	for i, g := range groups {
		ids[i] = g.ID
	}
	slices.Sort(ids)
	return ids
}

func findErrorGroup(groups []group.ErrorGroup, id string) *group.ErrorGroup {
	for i := range groups {
		if groups[i].ID == id {
			return &groups[i]
		}
	}
	return nil
}

func findErrorGroupBySeverity(groups []group.ErrorGroup, id string, severity event.Severity) *group.ErrorGroup {
	for i := range groups {
		if groups[i].ID == id && groups[i].Severity == severity {
			return &groups[i]
		}
	}
	return nil
}

func TestGetErrorGroupsWithFilterCoversEverySource(t *testing.T) {
	f := newErrorKindsFixture(t)

	groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, f.filter(nil))
	if err != nil {
		t.Fatalf("GetErrorGroupsWithFilter: %v", err)
	}
	if len(groups) != 7 {
		t.Fatalf("want one row per seeded group, got %d: %+v", len(groups), groups)
	}

	cases := []struct {
		id           string
		wantType     string
		wantSeverity event.Severity
	}{
		{fpCrash, "exception", event.SeverityFatal},
		{fpANR, "anr", event.SeverityFatal},
		{fpHandled, "exception", event.SeverityHandled},
		{fpUnhandled, "exception", event.SeverityUnhandled},
		{fpLegacyCrash, "exception", event.SeverityFatal},
		{fpLegacyHandled, "exception", event.SeverityHandled},
		{fpPatched, "exception", event.SeverityFatal},
	}

	for _, c := range cases {
		g := findErrorGroup(groups, c.id)
		if g == nil {
			t.Errorf("missing row for fingerprint %s", c.id)
			continue
		}
		if g.ErrorType != c.wantType {
			t.Errorf("fingerprint %s: error_type = %q, want %q", c.id, g.ErrorType, c.wantType)
		}
		if g.Severity != c.wantSeverity {
			t.Errorf("fingerprint %s: severity = %q, want %q", c.id, g.Severity, c.wantSeverity)
		}
	}
}

func TestGetErrorGroupsWithFilterByErrorType(t *testing.T) {
	f := newErrorKindsFixture(t)

	tests := []struct {
		name     string
		operator exprfilter.Operator
		values   []string
		want     []string
	}{
		{
			name:   "a crash covers the severity and the legacy unhandled row",
			values: []string{exprfilter.ErrorTypeCrash},
			want:   []string{fpCrash, fpLegacyCrash, fpPatched},
		},
		{
			name:   "an anr",
			values: []string{exprfilter.ErrorTypeANR},
			want:   []string{fpANR},
		},
		{
			name:   "a handled error covers the legacy handled row",
			values: []string{exprfilter.ErrorTypeHandledError},
			want:   []string{fpHandled, fpLegacyHandled},
		},
		{
			name:   "an unhandled error needs a named severity",
			values: []string{exprfilter.ErrorTypeUnhandledError},
			want:   []string{fpUnhandled},
		},
		{
			name:   "many kinds match either",
			values: []string{exprfilter.ErrorTypeCrash, exprfilter.ErrorTypeANR},
			want:   []string{fpANR, fpCrash, fpLegacyCrash, fpPatched},
		},
		{
			name:     "not in leaves a kind out",
			operator: exprfilter.OperatorNotIn,
			values:   []string{exprfilter.ErrorTypeCrash},
			want:     []string{fpANR, fpHandled, fpLegacyHandled, fpUnhandled},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			operator := test.operator
			if operator == "" {
				operator = exprfilter.OperatorIn
			}
			exprTree := leaf("error_type", operator, test.values...)
			want := slices.Clone(test.want)
			slices.Sort(want)
			if got := groupIDs(t, f, f.filter(&exprTree)); !slices.Equal(got, want) {
				t.Fatalf("want %v, got %v", want, got)
			}
		})
	}
}

func TestGetErrorGroupsWithFilterByAttributes(t *testing.T) {
	f := newErrorKindsFixture(t)

	tests := []struct {
		name     string
		exprTree exprfilter.ExprTree
		want     []string
	}{
		{
			name:     "version name",
			exprTree: leaf("version_name", exprfilter.OperatorIn, "1.2.0"),
			want:     []string{fpPatched},
		},
		{
			name:     "version code",
			exprTree: leaf("version_code", exprfilter.OperatorIn, "120"),
			want:     []string{fpPatched},
		},
		{
			name:     "patch id",
			exprTree: leaf("patch_id", exprfilter.OperatorIn, f.patchID.String()),
			want:     []string{fpPatched},
		},
		{
			name:     "patch version",
			exprTree: leaf("patch_version", exprfilter.OperatorIn, "1.2.0-patch.3"),
			want:     []string{fpPatched},
		},
		{
			name:     "no patch",
			exprTree: leaf("patch_id", exprfilter.OperatorIsNotSet),
			want:     []string{fpCrash, fpANR, fpHandled, fpUnhandled, fpLegacyCrash, fpLegacyHandled},
		},
		{
			name:     "user id",
			exprTree: leaf("user_id", exprfilter.OperatorIn, "ana"),
			want:     []string{fpCrash, fpPatched},
		},
		{
			name:     "os name",
			exprTree: leaf("os_name", exprfilter.OperatorIn, "ios"),
			want:     []string{fpPatched},
		},
		{
			name:     "country",
			exprTree: leaf("country", exprfilter.OperatorIn, "IN"),
			want:     []string{fpPatched},
		},
		{
			name: "an error kind and an os name together",
			exprTree: exprfilter.ExprTree{LogicalOperator: exprfilter.LogicalAnd, Children: []exprfilter.ExprTree{
				leaf("error_type", exprfilter.OperatorIn, exprfilter.ErrorTypeCrash),
				leaf("os_name", exprfilter.OperatorIn, "android"),
			}},
			want: []string{fpCrash, fpLegacyCrash},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			want := slices.Clone(test.want)
			slices.Sort(want)
			exprTree := test.exprTree
			if got := groupIDs(t, f, f.filter(&exprTree)); !slices.Equal(got, want) {
				t.Fatalf("want %v, got %v", want, got)
			}
		})
	}
}

func TestGetErrorGroupsWithFilterByCustomAttribute(t *testing.T) {
	f := newErrorKindsFixture(t)

	th.SeedUDAttrRow(f.ctx, t, f.teamIDStr(), f.appIDStr(), testinfra.UDAttrRow{
		EventID: f.crashEvent.String(), Key: "plan", Value: "pro", Timestamp: f.ts,
	})

	list := func(t *testing.T, exprTree exprfilter.ExprTree) []string {
		t.Helper()
		ef := f.filter(&exprTree)
		resolveCustomKeys(t, ef)
		return groupIDs(t, f, ef)
	}

	t.Run("a value narrows to the error carrying it", func(t *testing.T) {
		if got := list(t, leaf("custom.plan", exprfilter.OperatorIn, "pro")); !slices.Equal(got, []string{fpCrash}) {
			t.Fatalf("want the crash group, got %v", got)
		}
	})

	t.Run("a custom key beside a built-in key", func(t *testing.T) {
		got := list(t, exprfilter.ExprTree{LogicalOperator: exprfilter.LogicalAnd, Children: []exprfilter.ExprTree{
			leaf("custom.plan", exprfilter.OperatorIn, "pro"),
			leaf("error_type", exprfilter.OperatorIn, exprfilter.ErrorTypeCrash),
		}})
		if !slices.Equal(got, []string{fpCrash}) {
			t.Fatalf("want the crash group, got %v", got)
		}
	})

	t.Run("an attribute no error carries matches nothing", func(t *testing.T) {
		if got := list(t, leaf("custom.plan", exprfilter.OperatorIn, "free")); len(got) != 0 {
			t.Fatalf("want no groups, got %v", got)
		}
	})
}

func TestGetErrorGroupsWithFilterPaginates(t *testing.T) {
	f := newErrorKindsFixture(t)

	ef := f.filter(nil)
	ef.Limit = 3

	groups, next, previous, err := f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, ef)
	if err != nil {
		t.Fatalf("GetErrorGroupsWithFilter: %v", err)
	}
	if len(groups) != 3 || !next || previous {
		t.Fatalf("want the first page with more to come, got %d groups next=%v previous=%v", len(groups), next, previous)
	}

	ef.Offset = 6
	groups, next, previous, err = f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, ef)
	if err != nil {
		t.Fatalf("GetErrorGroupsWithFilter: %v", err)
	}
	if len(groups) != 1 || next || !previous {
		t.Fatalf("want the last page with pages before it, got %d groups next=%v previous=%v", len(groups), next, previous)
	}
}

// A fingerprint present in both the fatal and nonfatal group tables.
const fpSharedFatalHandled = "0000000000000000000000000000c020"

// TestGetErrorGroupsWithFilterSharedFingerprintCounts guards against the
// count-duplication bug where a fingerprint present in both the fatal and
// nonfatal group tables had the combined event total reported on every
// per-severity row. Each row must carry only the count for its own severity.
func TestGetErrorGroupsWithFilterSharedFingerprintCounts(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Now().UTC()
	teamID, appID := f.teamIDStr(), f.appIDStr()

	seedExceptionGroup(f.ctx, t, teamID, appID, fpSharedFatalHandled)
	seedNonfatalExceptionGroup(f.ctx, t, teamID, appID, fpSharedFatalHandled, true, false)
	seedIssueEventWithSeverity(f.ctx, t, teamID, appID, fpSharedFatalHandled, "fatal", ts)
	for range 3 {
		seedIssueEventWithSeverity(f.ctx, t, teamID, appID, fpSharedFatalHandled, "handled", ts)
	}

	ef := f.errorExprFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", exprfilter.PlotTimeGroupDays)

	groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, ef)
	if err != nil {
		t.Fatalf("GetErrorGroupsWithFilter: %v", err)
	}
	if len(groups) != 2 {
		t.Fatalf("want one row per severity class, got %d: %+v", len(groups), groups)
	}

	wantCounts := map[event.Severity]uint64{
		event.SeverityFatal:   1,
		event.SeverityHandled: 3,
	}
	for severity, wantCount := range wantCounts {
		g := findErrorGroupBySeverity(groups, fpSharedFatalHandled, severity)
		if g == nil {
			t.Errorf("missing row for severity %s", severity)
			continue
		}
		if g.Count != wantCount {
			t.Errorf("severity %s: count = %d, want %d", severity, g.Count, wantCount)
		}
	}
}

// 32-char fingerprints for is_custom tests.
const (
	fpCustomFatal   = "0000000000000000000000000000c030"
	fpCustomHandled = "0000000000000000000000000000c031"
	fpNativeFatal   = "0000000000000000000000000000c032"
	fpCustomANRish  = "0000000000000000000000000000c033"
)

// TestGetErrorGroupsWithFilterIsCustomPopulated confirms is_custom is true for
// the custom-captured rows and false otherwise, ANRs included since an ANR is
// never custom-captured.
func TestGetErrorGroupsWithFilterIsCustomPopulated(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Now().UTC()
	teamID, appID := f.teamIDStr(), f.appIDStr()

	seedFatalExceptionGroupWithCustomFlag(f.ctx, t, teamID, appID, fpCustomFatal, true)
	seedIssueEventWithCustomFlag(f.ctx, t, teamID, appID, fpCustomFatal, false, true, ts)

	seedNonfatalExceptionGroup(f.ctx, t, teamID, appID, fpCustomHandled, true, true)
	seedIssueEventWithCustomFlag(f.ctx, t, teamID, appID, fpCustomHandled, true, true, ts)

	seedFatalExceptionGroupWithCustomFlag(f.ctx, t, teamID, appID, fpNativeFatal, false)
	seedIssueEventWithCustomFlag(f.ctx, t, teamID, appID, fpNativeFatal, false, false, ts)

	seedAnrGroup(f.ctx, t, teamID, appID, fpCustomANRish)
	seedIssueEvent(f.ctx, t, teamID, appID, "anr", fpCustomANRish, false, ts)

	ef := f.errorExprFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", exprfilter.PlotTimeGroupDays)

	groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, ef)
	if err != nil {
		t.Fatalf("GetErrorGroupsWithFilter: %v", err)
	}
	if len(groups) != 4 {
		t.Fatalf("want 4 rows, got %d: %+v", len(groups), groups)
	}

	want := map[string]bool{
		fpCustomFatal:   true,
		fpCustomHandled: true,
		fpNativeFatal:   false,
		fpCustomANRish:  false,
	}
	for id, wantCustom := range want {
		g := findErrorGroup(groups, id)
		if g == nil {
			t.Errorf("missing row for %s", id)
			continue
		}
		if g.IsCustom != wantCustom {
			t.Errorf("row %s: is_custom = %t, want %t", id, g.IsCustom, wantCustom)
		}
	}
}
