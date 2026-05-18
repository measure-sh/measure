//go:build integration

package measure

import (
	"testing"
	"time"

	"backend/api/event"
	"backend/api/filter"
	"backend/api/group"
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
	// GetErrorGroupsWithFilter returns empty when no severity flag is set;
	// enable all three branches explicitly.
	af.Crash = true
	af.Error = true
	af.ANR = true

	groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, af)
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
			name:     "crash flag returns fatal only",
			modify:   func(af *filter.AppFilter) { af.Crash = true },
			wantIDs:  map[string]event.Severity{fpGroupFatal: event.SeverityFatal},
			wantType: map[string]string{fpGroupFatal: "exception"},
		},
		{
			name:     "severity=fatal returns fatal only",
			modify:   func(af *filter.AppFilter) { af.Severity = event.SeverityFatal },
			wantIDs:  map[string]event.Severity{fpGroupFatal: event.SeverityFatal},
			wantType: map[string]string{fpGroupFatal: "exception"},
		},
		{
			name:     "severity=handled returns handled nonfatal only",
			modify:   func(af *filter.AppFilter) { af.Severity = event.SeverityHandled },
			wantIDs:  map[string]event.Severity{fpGroupHandled: event.SeverityHandled},
			wantType: map[string]string{fpGroupHandled: "exception"},
		},
		{
			name:     "severity=unhandled returns unhandled nonfatal only",
			modify:   func(af *filter.AppFilter) { af.Severity = event.SeverityUnhandled },
			wantIDs:  map[string]event.Severity{fpGroupUnhandled: event.SeverityUnhandled},
			wantType: map[string]string{fpGroupUnhandled: "exception"},
		},
		{
			name:   "anr flag returns ANR only",
			modify: func(af *filter.AppFilter) { af.ANR = true },
			wantIDs: map[string]event.Severity{
				fpGroupANR: event.SeverityFatal,
			},
			wantType: map[string]string{fpGroupANR: "anr"},
		},
		{
			name:   "error flag returns both nonfatal severities",
			modify: func(af *filter.AppFilter) { af.Error = true },
			wantIDs: map[string]event.Severity{
				fpGroupHandled:   event.SeverityHandled,
				fpGroupUnhandled: event.SeverityUnhandled,
			},
			wantType: map[string]string{
				fpGroupHandled:   "exception",
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

			groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, af)
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
// one ANR. ANRs are never custom — they exist to confirm CustomError=true
// excludes them.
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

// TestGetErrorGroupsWithFilterCustomErrorFilter confirms that ?custom=true
// restricts the result to custom-captured exceptions (excludes native
// exceptions and all ANRs) and that the is_custom field is populated.
func TestGetErrorGroupsWithFilterCustomErrorFilter(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Now().UTC()
	seedCustomMix(f, t, ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "", "")
	af.Crash = true
	af.Error = true
	af.ANR = true
	af.CustomError = true

	groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, af)
	if err != nil {
		t.Fatalf("GetErrorGroupsWithFilter: %v", err)
	}

	wantIDs := map[string]bool{
		fpGroupCustomFatal:   true,
		fpGroupCustomHandled: true,
	}
	if len(groups) != len(wantIDs) {
		t.Fatalf("got %d rows, want %d (custom only): %+v", len(groups), len(wantIDs), groups)
	}
	for _, g := range groups {
		if !wantIDs[g.ID] {
			t.Errorf("unexpected row %s in custom-only result", g.ID)
		}
		if !g.IsCustom {
			t.Errorf("row %s: is_custom = false, want true", g.ID)
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
	af.Crash = true
	af.Error = true
	af.ANR = true

	groups, _, _, err := f.app.GetErrorGroupsWithFilter(f.ctx, af)
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
// honors ?custom=true on the exception branch.
func TestGetErrorPlotInstancesCustomErrorFilter(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Now().UTC()
	seedCustomMix(f, t, ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	af.CustomError = true

	items, err := f.app.GetErrorPlotInstances(f.ctx, af)
	if err != nil {
		t.Fatalf("GetErrorPlotInstances: %v", err)
	}
	if got := sumIssueInstances(items); got != 2 {
		t.Fatalf("instances = %d, want 2 (two custom exception events), items=%+v", got, items)
	}
}
