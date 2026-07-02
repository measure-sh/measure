//go:build integration

package measure

import (
	"testing"
	"time"

	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/group"
)

// 32-char fingerprints (events.exception.fingerprint and anr.fingerprint are
// FixedString(32)).
const (
	fpGroupFatal     = "0000000000000000000000000000000a"
	fpGroupHandled   = "0000000000000000000000000000000b"
	fpGroupUnhandled = "0000000000000000000000000000000c"
	fpGroupANR       = "0000000000000000000000000000000d"
)

// seedAllErrorSources writes one row of each kind (fatal, handled nonfatal,
// unhandled nonfatal, ANR) to both the events table and the corresponding
// *_groups aggregating table — necessary because GetErrorGroupsWithFilter
// joins the groups CTE against an events count CTE and filters out rows with
// zero matching events.
func seedAllErrorSources(f plotFixture, t *testing.T, ts time.Time) {
	t.Helper()
	teamID, appID := f.teamIDStr(), f.appIDStr()

	seedExceptionGroup(f.ctx, t, teamID, appID, fpGroupFatal)
	seedIssueEvent(f.ctx, t, teamID, appID, "exception", fpGroupFatal, false, ts)

	seedNonfatalExceptionGroup(f.ctx, t, teamID, appID, fpGroupHandled, true, false)
	seedIssueEvent(f.ctx, t, teamID, appID, "exception", fpGroupHandled, true, ts)

	seedNonfatalExceptionGroup(f.ctx, t, teamID, appID, fpGroupUnhandled, false, false)
	seedIssueEvent(f.ctx, t, teamID, appID, "exception", fpGroupUnhandled, false, ts)

	seedAnrGroup(f.ctx, t, teamID, appID, fpGroupANR)
	seedIssueEvent(f.ctx, t, teamID, appID, "anr", fpGroupANR, false, ts)
}

func findErrorGroup(groups []group.ErrorGroup, id string) *group.ErrorGroup {
	for i := range groups {
		if groups[i].ID == id {
			return &groups[i]
		}
	}
	return nil
}

// TestGetErrorGroupsWithFilterTypeAndSeverity confirms that the type and
// severity fields are populated correctly for each source.
func TestGetErrorGroupsWithFilterTypeAndSeverity(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Now().UTC()
	seedAllErrorSources(f, t, ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "", "")
	af.ErrorTypes = []event.ErrorType{event.ErrorTypeError, event.ErrorTypeANR}

	groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetErrorGroupsWithFilter: %v", err)
	}
	if len(groups) != 4 {
		t.Fatalf("expected 4 rows (one per source), got %d: %+v", len(groups), groups)
	}

	cases := []struct {
		id           string
		wantType     string
		wantSeverity event.Severity
	}{
		{fpGroupFatal, "exception", event.SeverityFatal},
		{fpGroupHandled, "exception", event.SeverityHandled},
		{fpGroupUnhandled, "exception", event.SeverityUnhandled},
		{fpGroupANR, "anr", event.SeverityFatal},
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

// TestGetErrorGroupsWithFilterSeverityFiltering exercises each severity flag
// and confirms the returned rows carry the right (type, severity) pair.
func TestGetErrorGroupsWithFilterSeverityFiltering(t *testing.T) {
	cases := []struct {
		name     string
		modify   func(af *filter.AppFilter)
		wantIDs  map[string]event.Severity
		wantType map[string]string
	}{
		{
			name: "type=error with severity=fatal returns fatal only",
			modify: func(af *filter.AppFilter) {
				af.ErrorTypes = []event.ErrorType{event.ErrorTypeError}
				af.Severities = []event.Severity{event.SeverityFatal}
			},
			wantIDs:  map[string]event.Severity{fpGroupFatal: event.SeverityFatal},
			wantType: map[string]string{fpGroupFatal: "exception"},
		},
		{
			name:     "severity=fatal returns fatal only",
			modify:   func(af *filter.AppFilter) { af.Severities = []event.Severity{event.SeverityFatal} },
			wantIDs:  map[string]event.Severity{fpGroupFatal: event.SeverityFatal},
			wantType: map[string]string{fpGroupFatal: "exception"},
		},
		{
			name:     "severity=handled returns handled nonfatal only",
			modify:   func(af *filter.AppFilter) { af.Severities = []event.Severity{event.SeverityHandled} },
			wantIDs:  map[string]event.Severity{fpGroupHandled: event.SeverityHandled},
			wantType: map[string]string{fpGroupHandled: "exception"},
		},
		{
			name:     "severity=unhandled returns unhandled nonfatal only",
			modify:   func(af *filter.AppFilter) { af.Severities = []event.Severity{event.SeverityUnhandled} },
			wantIDs:  map[string]event.Severity{fpGroupUnhandled: event.SeverityUnhandled},
			wantType: map[string]string{fpGroupUnhandled: "exception"},
		},
		{
			name:   "type=anr returns ANR only",
			modify: func(af *filter.AppFilter) { af.ErrorTypes = []event.ErrorType{event.ErrorTypeANR} },
			wantIDs: map[string]event.Severity{
				fpGroupANR: event.SeverityFatal,
			},
			wantType: map[string]string{fpGroupANR: "anr"},
		},
		{
			name: "type=error with nonfatal severities returns both nonfatal",
			modify: func(af *filter.AppFilter) {
				af.ErrorTypes = []event.ErrorType{event.ErrorTypeError}
				af.Severities = []event.Severity{event.SeverityHandled, event.SeverityUnhandled}
			},
			wantIDs: map[string]event.Severity{
				fpGroupHandled:   event.SeverityHandled,
				fpGroupUnhandled: event.SeverityUnhandled,
			},
			wantType: map[string]string{
				fpGroupHandled:   "exception",
				fpGroupUnhandled: "exception",
			},
		},
		{
			// ANR is unaffected by severity — must appear alongside fatal exception.
			name: "type=error,anr with severity=fatal returns fatal exception and ANR",
			modify: func(af *filter.AppFilter) {
				af.ErrorTypes = []event.ErrorType{event.ErrorTypeError, event.ErrorTypeANR}
				af.Severities = []event.Severity{event.SeverityFatal}
			},
			wantIDs: map[string]event.Severity{
				fpGroupFatal: event.SeverityFatal,
				fpGroupANR:   event.SeverityFatal,
			},
			wantType: map[string]string{
				fpGroupFatal: "exception",
				fpGroupANR:   "anr",
			},
		},
		{
			// ANR must appear alongside handled exception when severity=handled.
			name: "type=error,anr with severity=handled returns handled exception and ANR",
			modify: func(af *filter.AppFilter) {
				af.ErrorTypes = []event.ErrorType{event.ErrorTypeError, event.ErrorTypeANR}
				af.Severities = []event.Severity{event.SeverityHandled}
			},
			wantIDs: map[string]event.Severity{
				fpGroupHandled: event.SeverityHandled,
				fpGroupANR:     event.SeverityFatal,
			},
			wantType: map[string]string{
				fpGroupHandled: "exception",
				fpGroupANR:     "anr",
			},
		},
		{
			name: "type=error,anr with severity=fatal,handled returns fatal, handled exception and ANR",
			modify: func(af *filter.AppFilter) {
				af.ErrorTypes = []event.ErrorType{event.ErrorTypeError, event.ErrorTypeANR}
				af.Severities = []event.Severity{event.SeverityFatal, event.SeverityHandled}
			},
			wantIDs: map[string]event.Severity{
				fpGroupFatal:   event.SeverityFatal,
				fpGroupHandled: event.SeverityHandled,
				fpGroupANR:     event.SeverityFatal,
			},
			wantType: map[string]string{
				fpGroupFatal:   "exception",
				fpGroupHandled: "exception",
				fpGroupANR:     "anr",
			},
		},
		{
			name: "type=error with severity=fatal,unhandled returns fatal and unhandled exception",
			modify: func(af *filter.AppFilter) {
				af.ErrorTypes = []event.ErrorType{event.ErrorTypeError}
				af.Severities = []event.Severity{event.SeverityFatal, event.SeverityUnhandled}
			},
			wantIDs: map[string]event.Severity{
				fpGroupFatal:     event.SeverityFatal,
				fpGroupUnhandled: event.SeverityUnhandled,
			},
			wantType: map[string]string{
				fpGroupFatal:     "exception",
				fpGroupUnhandled: "exception",
			},
		},
	}

	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			f := newPlotFixture(t)
			ts := time.Now().UTC()
			seedAllErrorSources(f, t, ts)

			af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "", "")
			c.modify(af)

			groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, af)
			if err != nil {
				t.Fatalf("GetErrorGroupsWithFilter: %v", err)
			}
			if len(groups) != len(c.wantIDs) {
				t.Fatalf("got %d rows, want %d: %+v", len(groups), len(c.wantIDs), groups)
			}
			for id, wantSev := range c.wantIDs {
				g := findErrorGroup(groups, id)
				if g == nil {
					t.Errorf("missing row for fingerprint %s", id)
					continue
				}
				if g.Severity != wantSev {
					t.Errorf("fingerprint %s: severity = %q, want %q", id, g.Severity, wantSev)
				}
				if g.ErrorType != c.wantType[id] {
					t.Errorf("fingerprint %s: error_type = %q, want %q", id, g.ErrorType, c.wantType[id])
				}
			}
		})
	}
}

// 32-char fingerprints shared across the fatal and nonfatal group tables —
// the same crash reported both fatally and nonfatally, which is the scenario
// the per-severity count split must handle.
const (
	fpSharedFatalHandled   = "00000000000000000000000000000020"
	fpSharedFatalUnhandled = "00000000000000000000000000000021"
)

// seedSharedFingerprintCounts writes two fingerprints that each live in BOTH
// fatal_exception_groups and nonfatal_exception_groups, with asymmetric event
// counts per severity. This reproduces the count-duplication bug: a single
// counts row joined to two per-severity group rows handed both the combined
// total.
//
//   - fpSharedFatalHandled:   1 fatal event + 3 handled events
//   - fpSharedFatalUnhandled: 1 fatal event + 2 unhandled events
//
// This seed is for the case where error groups were not symbolicated, but we still want the final instance count to be accurate no matter the severity.
func seedSharedFingerprintCounts(f plotFixture, t *testing.T, ts time.Time) {
	t.Helper()
	teamID, appID := f.teamIDStr(), f.appIDStr()

	seedExceptionGroup(f.ctx, t, teamID, appID, fpSharedFatalHandled)
	seedNonfatalExceptionGroup(f.ctx, t, teamID, appID, fpSharedFatalHandled, true, false)
	seedSeverityEvents(f, t, fpSharedFatalHandled, "fatal", 1, ts)
	seedSeverityEvents(f, t, fpSharedFatalHandled, "handled", 3, ts)

	seedExceptionGroup(f.ctx, t, teamID, appID, fpSharedFatalUnhandled)
	seedNonfatalExceptionGroup(f.ctx, t, teamID, appID, fpSharedFatalUnhandled, false, false)
	seedSeverityEvents(f, t, fpSharedFatalUnhandled, "fatal", 1, ts)
	seedSeverityEvents(f, t, fpSharedFatalUnhandled, "unhandled", 2, ts)
}

func seedSeverityEvents(f plotFixture, t *testing.T, fingerprint, severity string, n int, ts time.Time) {
	t.Helper()
	for i := 0; i < n; i++ {
		seedIssueEventWithSeverity(f.ctx, t, f.teamIDStr(), f.appIDStr(), fingerprint, severity, ts)
	}
}

// wantCount pairs an expected fingerprint+severity row with its event count.
type wantCount struct {
	id       string
	severity event.Severity
	count    uint64
}

// TestGetErrorGroupsWithFilterSharedFingerprintCounts guards against the
// count-duplication bug where a fingerprint present in both the fatal and
// nonfatal group tables had the combined event total reported on every
// per-severity row. Each row must carry only the count for its own severity.
func TestGetErrorGroupsWithFilterSharedFingerprintCounts(t *testing.T) {
	cases := []struct {
		name       string
		severities []event.Severity
		want       []wantCount
	}{
		{
			name:       "fatal,handled splits counts per severity",
			severities: []event.Severity{event.SeverityFatal, event.SeverityHandled},
			want: []wantCount{
				{fpSharedFatalHandled, event.SeverityFatal, 1},
				{fpSharedFatalHandled, event.SeverityHandled, 3},
				// unhandled twin contributes only its fatal row here.
				{fpSharedFatalUnhandled, event.SeverityFatal, 1},
			},
		},
		{
			name:       "fatal,unhandled splits counts per severity",
			severities: []event.Severity{event.SeverityFatal, event.SeverityUnhandled},
			want: []wantCount{
				{fpSharedFatalHandled, event.SeverityFatal, 1},
				{fpSharedFatalUnhandled, event.SeverityFatal, 1},
				{fpSharedFatalUnhandled, event.SeverityUnhandled, 2},
			},
		},
		{
			name:       "handled,unhandled excludes fatal events",
			severities: []event.Severity{event.SeverityHandled, event.SeverityUnhandled},
			want: []wantCount{
				{fpSharedFatalHandled, event.SeverityHandled, 3},
				{fpSharedFatalUnhandled, event.SeverityUnhandled, 2},
			},
		},
		{
			name:       "fatal,handled,unhandled covers every row",
			severities: []event.Severity{event.SeverityFatal, event.SeverityHandled, event.SeverityUnhandled},
			want: []wantCount{
				{fpSharedFatalHandled, event.SeverityFatal, 1},
				{fpSharedFatalHandled, event.SeverityHandled, 3},
				{fpSharedFatalUnhandled, event.SeverityFatal, 1},
				{fpSharedFatalUnhandled, event.SeverityUnhandled, 2},
			},
		},
		{
			name:       "fatal returns fatal counts only",
			severities: []event.Severity{event.SeverityFatal},
			want: []wantCount{
				{fpSharedFatalHandled, event.SeverityFatal, 1},
				{fpSharedFatalUnhandled, event.SeverityFatal, 1},
			},
		},
	}

	for _, c := range cases {
		c := c
		t.Run(c.name, func(t *testing.T) {
			f := newPlotFixture(t)
			ts := time.Now().UTC()
			seedSharedFingerprintCounts(f, t, ts)

			af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "", "")
			af.ErrorTypes = []event.ErrorType{event.ErrorTypeError}
			af.Severities = c.severities

			groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, af)
			if err != nil {
				t.Fatalf("GetErrorGroupsWithFilter: %v", err)
			}
			if len(groups) != len(c.want) {
				t.Fatalf("got %d rows, want %d: %+v", len(groups), len(c.want), groups)
			}
			for _, w := range c.want {
				g := findErrorGroupBySeverity(groups, w.id, w.severity)
				if g == nil {
					t.Errorf("missing row for fingerprint %s severity %s", w.id, w.severity)
					continue
				}
				if g.Count != w.count {
					t.Errorf("fingerprint %s severity %s: count = %d, want %d", w.id, w.severity, g.Count, w.count)
				}
			}
		})
	}
}

func findErrorGroupBySeverity(groups []group.ErrorGroup, id string, severity event.Severity) *group.ErrorGroup {
	for i := range groups {
		if groups[i].ID == id && groups[i].Severity == severity {
			return &groups[i]
		}
	}
	return nil
}

// 32-char fingerprints for is_custom tests.
const (
	fpGroupCustomFatal    = "0000000000000000000000000000000e"
	fpGroupCustomHandled  = "0000000000000000000000000000000f"
	fpGroupNativeFatal    = "00000000000000000000000000000010"
	fpGroupNativeUnhandld = "00000000000000000000000000000011"
	fpGroupCustomANRish   = "00000000000000000000000000000012"
)

// seedCustomMix seeds two custom-captured exceptions (one fatal, one handled
// nonfatal), two native exceptions (one fatal, one unhandled nonfatal), and
// one ANR. ANRs are never custom — they exist to verify is_custom is false
// on ANR rows and that type=error+custom=1 still excludes them.
func seedCustomMix(f plotFixture, t *testing.T, ts time.Time) {
	t.Helper()
	teamID, appID := f.teamIDStr(), f.appIDStr()

	seedFatalExceptionGroupWithCustomFlag(f.ctx, t, teamID, appID, fpGroupCustomFatal, true)
	seedIssueEventWithCustomFlag(f.ctx, t, teamID, appID, fpGroupCustomFatal, false, true, ts)

	seedNonfatalExceptionGroup(f.ctx, t, teamID, appID, fpGroupCustomHandled, true, true)
	seedIssueEventWithCustomFlag(f.ctx, t, teamID, appID, fpGroupCustomHandled, true, true, ts)

	seedFatalExceptionGroupWithCustomFlag(f.ctx, t, teamID, appID, fpGroupNativeFatal, false)
	seedIssueEventWithCustomFlag(f.ctx, t, teamID, appID, fpGroupNativeFatal, false, false, ts)

	seedNonfatalExceptionGroup(f.ctx, t, teamID, appID, fpGroupNativeUnhandld, false, false)
	seedIssueEventWithCustomFlag(f.ctx, t, teamID, appID, fpGroupNativeUnhandld, false, false, ts)

	seedAnrGroup(f.ctx, t, teamID, appID, fpGroupCustomANRish)
	seedIssueEvent(f.ctx, t, teamID, appID, "anr", fpGroupCustomANRish, false, ts)
}

// TestGetErrorGroupsWithFilterCustomErrorFilter confirms that ?custom=true with
// type=error,anr returns custom exceptions AND ANRs (ANRs are always included
// when explicitly requested), while native exceptions are excluded.
// is_custom is true for custom exceptions and false for ANRs.
func TestGetErrorGroupsWithFilterCustomErrorFilter(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Now().UTC()
	seedCustomMix(f, t, ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "", "")
	af.ErrorTypes = []event.ErrorType{event.ErrorTypeError, event.ErrorTypeANR}
	af.CustomError = true

	groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetErrorGroupsWithFilter: %v", err)
	}

	// ANRs are included because type=error,anr explicitly requests them;
	// is_custom is false for ANR rows since ANRs are never custom-captured.
	wantIsCustom := map[string]bool{
		fpGroupCustomFatal:   true,
		fpGroupCustomHandled: true,
		fpGroupCustomANRish:  false,
	}
	if len(groups) != len(wantIsCustom) {
		t.Fatalf("got %d rows, want %d: %+v", len(groups), len(wantIsCustom), groups)
	}
	for _, g := range groups {
		want, ok := wantIsCustom[g.ID]
		if !ok {
			t.Errorf("unexpected row %s in result", g.ID)
			continue
		}
		if g.IsCustom != want {
			t.Errorf("row %s: is_custom = %t, want %t", g.ID, g.IsCustom, want)
		}
	}
}

// TestGetErrorGroupsWithFilterIsCustomPopulated confirms is_custom is set
// correctly on every row when no custom filter is applied — true for
// custom-captured rows, false otherwise (including ANR).
func TestGetErrorGroupsWithFilterIsCustomPopulated(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Now().UTC()
	seedCustomMix(f, t, ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "", "")
	af.ErrorTypes = []event.ErrorType{event.ErrorTypeError, event.ErrorTypeANR}

	groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetErrorGroupsWithFilter: %v", err)
	}
	if len(groups) != 5 {
		t.Fatalf("expected 5 rows, got %d: %+v", len(groups), groups)
	}

	want := map[string]bool{
		fpGroupCustomFatal:    true,
		fpGroupCustomHandled:  true,
		fpGroupNativeFatal:    false,
		fpGroupNativeUnhandld: false,
		fpGroupCustomANRish:   false,
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

// TestGetErrorPlotInstancesCustomErrorFilter confirms the overview plot
// honors ?custom=true: custom exceptions and ANRs (no explicit type = include
// all) are counted, while native exceptions are excluded.
func TestGetErrorPlotInstancesCustomErrorFilter(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Now().UTC()
	seedCustomMix(f, t, ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	af.CustomError = true

	items, err := f.app.GetErrorPlotInstances(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetErrorPlotInstances: %v", err)
	}
	// 2 custom exception events + 1 ANR event (type omitted → ANRs included).
	if got := sumIssueInstances(items); got != 3 {
		t.Fatalf("instances = %d, want 3 (two custom exceptions + one ANR), items=%+v", got, items)
	}
}
