//go:build integration

package measure

import (
	"testing"
	"time"

	"backend/libs/ambient"
	"backend/libs/event"
	"backend/libs/filter"
	"backend/libs/group"
)

// 32-char fingerprints, matching the convention in error_groups_test.go.
const (
	fpJourneyFatal         = "000000000000000000000000000000f1"
	fpJourneyUnhandled     = "000000000000000000000000000000f2"
	fpJourneyHandled       = "000000000000000000000000000000f3"
	fpJourneyLegacyFatal   = "000000000000000000000000000000f4"
	fpJourneyLegacyHandled = "000000000000000000000000000000f5"
)

// TestGetJourneyEventsScansSeverity drives journey_mv from raw events, then
// asserts GetJourneyEvents both (a) filters exception rows to fatal-only via
// the SQL predicate & (b) scans the real severity into Exception.Severity
// rather than leaving it zero, so IsFatalException() reflects the row.
//
// Table-driven over the two production callers' actual opts shape (All:true,
// Android & Apple, each a separate SQL string edited independently in Stage
// A) plus the Exceptions:true branch, which only tests exercise. Android's
// All branch carries one extra bound arg (the ANR clause) than Apple's, so
// covering both here is what catches a placeholder/arg misalignment.
func TestGetJourneyEventsScansSeverity(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 10, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	// New-SDK severity-tagged exceptions, handled always false (no current
	// SDK sends it).
	seedIssueEventWithSeverity(f.ctx, t, team, app, fpJourneyFatal, "fatal", ts)
	seedIssueEventWithSeverity(f.ctx, t, team, app, fpJourneyUnhandled, "unhandled", ts)
	seedIssueEventWithSeverity(f.ctx, t, team, app, fpJourneyHandled, "handled", ts)
	// Legacy exceptions, no severity: handled decides fatality.
	seedIssueEvent(f.ctx, t, team, app, "exception", fpJourneyLegacyFatal, false, ts)
	seedIssueEvent(f.ctx, t, team, app, "exception", fpJourneyLegacyHandled, true, ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", "")

	cases := []struct {
		name    string
		osNames []string
		opts    filter.JourneyOpts
	}{
		{"android all", []string{"Android"}, filter.JourneyOpts{All: true}},
		{"apple all", []string{"iOS"}, filter.JourneyOpts{All: true}},
		{"exceptions only", []string{"Android"}, filter.JourneyOpts{Exceptions: true}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a := App{ID: f.app.ID, TeamId: f.teamID, OSNames: c.osNames}

			events, err := a.GetJourneyEvents(f.ctx, deps.RchPool, af, c.opts)
			if err != nil {
				t.Fatalf("GetJourneyEvents: %v", err)
			}

			byFingerprint := map[string]event.EventField{}
			for _, ev := range events {
				if !ev.IsException() {
					continue
				}
				byFingerprint[ev.Exception.Fingerprint] = ev
			}

			// Unhandled & handled exceptions must not reach the journey graph
			// at all: journey issue nodes are fatal-only.
			for _, fp := range []string{fpJourneyUnhandled, fpJourneyHandled, fpJourneyLegacyHandled} {
				if _, ok := byFingerprint[fp]; ok {
					t.Errorf("fingerprint %s: present in journey events, want excluded (non-fatal)", fp)
				}
			}

			severityCases := []struct {
				fingerprint  string
				wantSeverity event.Severity
			}{
				{fpJourneyFatal, event.SeverityFatal},
				{fpJourneyLegacyFatal, ""},
			}
			for _, sc := range severityCases {
				ev, ok := byFingerprint[sc.fingerprint]
				if !ok {
					t.Errorf("fingerprint %s: missing from journey events, want present (fatal)", sc.fingerprint)
					continue
				}
				if ev.Exception.Severity != sc.wantSeverity {
					t.Errorf("fingerprint %s: Severity = %q, want %q", sc.fingerprint, ev.Exception.Severity, sc.wantSeverity)
				}
				if !ev.IsFatalException() {
					t.Errorf("fingerprint %s: IsFatalException() = false, want true", sc.fingerprint)
				}
			}
		})
	}
}

// TestGetExceptionGroupsFromFingerprintsCountsFatalOnly asserts event_count
// counts fatal exceptions only, excluding handled & unhandled ones sharing
// the same fingerprint's group row.
func TestGetExceptionGroupsFromFingerprintsCountsFatalOnly(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Now().UTC()
	team, app := f.teamIDStr(), f.appIDStr()

	fp := fpJourneyFatal
	seedExceptionGroup(f.ctx, t, team, app, fp)

	// 2 fatal (new-SDK + legacy), 1 unhandled, 1 handled, all same fingerprint.
	seedIssueEventWithSeverity(f.ctx, t, team, app, fp, "fatal", ts)
	seedIssueEvent(f.ctx, t, team, app, "exception", fp, false, ts) // legacy fatal
	seedIssueEventWithSeverity(f.ctx, t, team, app, fp, "unhandled", ts)
	seedIssueEvent(f.ctx, t, team, app, "exception", fp, true, ts) // legacy handled

	ctx := ambient.WithTeamId(f.ctx, f.teamID)
	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "", "")

	groups, err := group.GetExceptionGroupsFromFingerprints(ctx, deps.RchPool, af, []string{fp})
	if err != nil {
		t.Fatalf("GetExceptionGroupsFromFingerprints: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d: %+v", len(groups), groups)
	}
	if want := uint64(2); groups[0].Count != want {
		t.Errorf("event_count = %d, want %d (fatal only)", groups[0].Count, want)
	}
}
