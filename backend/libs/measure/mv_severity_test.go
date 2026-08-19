//go:build integration

package measure

import (
	"testing"
	"time"

	"backend/libs/ambient"
	"backend/libs/event"
	"backend/libs/filter"
)

// These tests drive the real app_filters_mv & app_metrics_mv by seeding raw
// events, not by inserting into the target tables, so they cover the MV SQL
// predicates themselves.

// crash_sessions counts fatal exceptions only: severity='fatal', or legacy
// rows with empty severity & handled=false. Unhandled, handled, legacy
// handled=true & non-exception rows must not contribute. ANR & generic rows
// also carry empty severity & handled=false, so they guard the
// type='exception' gate.
func TestAppMetricsMVCrashSessionsCountsOnlyFatal(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	// New-SDK severity-tagged exceptions, each its own session.
	seedIssueEventWithSeverity(f.ctx, t, team, app, "", "fatal", ts)     // crash
	seedIssueEventWithSeverity(f.ctx, t, team, app, "", "unhandled", ts) // not a crash
	seedIssueEventWithSeverity(f.ctx, t, team, app, "", "handled", ts)   // not a crash
	// Legacy exceptions without severity: handled decides fatality.
	seedIssueEvent(f.ctx, t, team, app, "exception", "", false, ts) // crash (legacy fatal)
	seedIssueEvent(f.ctx, t, team, app, "exception", "", true, ts)  // not a crash (legacy handled)
	// Non-exception rows: empty severity & handled=false would satisfy the
	// bridge on their own, so these guard the type='exception' gate itself.
	seedIssueEvent(f.ctx, t, team, app, "anr", "", false, ts) // not an exception
	seedGenericEvents(f.ctx, t, team, app, 1, ts)             // not an exception

	var crashSessions uint64
	row := deps.RchPool.QueryRow(f.ctx,
		`select uniqMerge(crash_sessions) from app_metrics final where team_id = toUUID(?) and app_id = toUUID(?)`,
		team, app)
	if err := row.Scan(&crashSessions); err != nil {
		t.Fatalf("query app_metrics: %v", err)
	}
	if crashSessions != 2 {
		t.Errorf("crash_sessions = %d, want 2 (severity=fatal + legacy handled=false)", crashSessions)
	}
}

// app_filters_mv's exception flag must be reachable for an attribute combo
// whose only exception is a legacy handled one (empty severity, handled=1),
// since the column now means "any exception" rather than "fatal exception
// only". The old predicate (handled=0) excluded exactly this row.
func TestAppFiltersMVExceptionFlagIncludesHandled(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	seedIssueEventWithFullAttributes(f.ctx, t, team, app, "", true, ts)

	ctx := ambient.WithTeamId(f.ctx, f.teamID)
	af := filter.AppFilter{
		AppID:      f.appID,
		ErrorTypes: []event.ErrorType{event.ErrorTypeError},
	}

	var fl filter.FilterList
	if err := af.GetGenericFilters(ctx, deps.RchPool, &fl, false, false); err != nil {
		t.Fatalf("GetGenericFilters: %v", err)
	}
	if len(fl.Versions) == 0 {
		t.Fatalf("expected version options for handled-only exception, got none")
	}
}

// GetIssueFreeMetrics must exclude handled exceptions from crash_free_sessions,
// counting only fatal ones as crashes.
func TestGetIssueFreeMetricsExcludesHandled(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()

	// 8 plain sessions, 1 fatal crash, 1 handled (non-crash).
	seedGenericEvents(f.ctx, t, team, app, 8, ts)
	seedIssueEventWithSeverity(f.ctx, t, team, app, "", "fatal", ts)
	seedIssueEventWithSeverity(f.ctx, t, team, app, "", "handled", ts)

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", filter.PlotTimeGroupDays)
	af.Versions = []string{"v1"}
	af.VersionCodes = []string{"1"}

	crashFree, _, _, _, err := f.app.GetIssueFreeMetrics(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetIssueFreeMetrics: %v", err)
	}
	// 10 total sessions (8 generic + 1 fatal + 1 handled), 1 crash.
	if want := 90.0; crashFree.CrashFreeSessions != want {
		t.Errorf("crash_free_sessions = %v, want %v (handled exception must not count as a crash)", crashFree.CrashFreeSessions, want)
	}
}
