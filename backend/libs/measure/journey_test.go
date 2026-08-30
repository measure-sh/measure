//go:build integration

package measure

import (
	"testing"
	"time"

	"backend/libs/ambient"
	"backend/libs/event"
	"backend/libs/group"

	"github.com/google/uuid"
)

// 32-char fingerprints, matching the convention in error_groups_test.go.
const (
	fpJourneyFatal      = "000000000000000000000000000000f1"
	fpJourneyHandled    = "000000000000000000000000000000f3"
	fpJourneyANR        = "000000000000000000000000000000f6"
	fpJourneyUnanchored = "000000000000000000000000000000f8"
	fpJourneyAndroid    = "000000000000000000000000000000a1"
	fpJourneyApple      = "000000000000000000000000000000b1"
)

// TestGetJourneyGraph drives journey_mv from raw events of two concurrent
// sessions whose events interleave in time, then asserts the aggregate keeps
// each session's transitions apart, orders nodes by first appearance, anchors
// only fatal issues to the node they occurred on & keeps an unanchored issue
// counted under no node.
func TestGetJourneyGraph(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 1, 10, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()
	sessionA, sessionB := uuid.NewString(), uuid.NewString()

	at := func(offset int) time.Time { return ts.Add(time.Duration(offset) * time.Second) }

	// A crash from a previous run lands first in its own session, so it has no
	// anchor. It stays counted, attached to no node.
	seedIssueEventInSession(f.ctx, t, team, app, sessionA, "exception", fpJourneyUnanchored, false, at(-1))

	// Sessions interleave: A, B, A, B. No edge may cross the two.
	seedLifecycleActivityInSession(f.ctx, t, team, app, sessionA, "resumed", "HomeActivity", at(0))
	seedLifecycleActivityInSession(f.ctx, t, team, app, sessionB, "resumed", "CartActivity", at(1))
	seedLifecycleActivityInSession(f.ctx, t, team, app, sessionA, "resumed", "DetailActivity", at(2))
	seedLifecycleActivityInSession(f.ctx, t, team, app, sessionB, "resumed", "CheckoutActivity", at(3))

	// Fatal crash on DetailActivity, handled one must not surface at all.
	seedIssueEventInSession(f.ctx, t, team, app, sessionA, "exception", fpJourneyFatal, false, at(4))
	seedIssueEventInSession(f.ctx, t, team, app, sessionA, "exception", fpJourneyHandled, true, at(5))
	// ANR on CheckoutActivity.
	seedIssueEventInSession(f.ctx, t, team, app, sessionB, "anr", fpJourneyANR, false, at(6))

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", "")
	a := App{ID: f.app.ID, TeamId: f.teamID, OSNames: []string{"Android"}}

	g, err := a.GetJourneyGraph(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetJourneyGraph: %v", err)
	}

	wantNodes := []string{"HomeActivity", "CartActivity", "DetailActivity", "CheckoutActivity"}
	if len(g.Nodes) != len(wantNodes) {
		t.Fatalf("nodes = %v, want %v", g.Nodes, wantNodes)
	}
	for i := range wantNodes {
		if g.Nodes[i] != wantNodes[i] {
			t.Errorf("node %d = %s, want %s (first appearance order)", i, g.Nodes[i], wantNodes[i])
		}
	}

	// Concurrent sessions must not link, so HomeActivity -> CartActivity or
	// DetailActivity -> CheckoutActivity would be wrong.
	wantEdges := map[string]uint64{
		"HomeActivity->DetailActivity":   1,
		"CartActivity->CheckoutActivity": 1,
	}
	if len(g.Edges) != len(wantEdges) {
		t.Fatalf("edges = %+v, want exactly %v", g.Edges, wantEdges)
	}
	for _, edge := range g.Edges {
		key := edge.Source + "->" + edge.Target
		sessions, ok := wantEdges[key]
		if !ok {
			t.Errorf("unexpected edge %s, sessions must not link", key)
			continue
		}
		if edge.Sessions != sessions {
			t.Errorf("edge %s sessions = %d, want %d", key, edge.Sessions, sessions)
		}
	}

	wantIssues := map[string]JourneyIssue{
		fpJourneyFatal: {Node: "DetailActivity", Fingerprint: fpJourneyFatal, Count: 1},
		fpJourneyANR:   {Node: "CheckoutActivity", Fingerprint: fpJourneyANR, IsANR: true, Count: 1},
		// Empty node keeps it counted while attaching it nowhere.
		fpJourneyUnanchored: {Node: "", Fingerprint: fpJourneyUnanchored, Count: 1},
	}
	if len(g.Issues) != len(wantIssues) {
		t.Fatalf("issues = %+v, want %+v", g.Issues, wantIssues)
	}
	for _, issue := range g.Issues {
		want, ok := wantIssues[issue.Fingerprint]
		if !ok {
			t.Errorf("unexpected issue %+v, want fatal issues only", issue)
			continue
		}
		if issue != want {
			t.Errorf("issue = %+v, want %+v", issue, want)
		}
	}
}

// TestGetJourneyGraphAndroidNodeTypes asserts fragments & screen views become
// Android nodes, that one transition seen in two sessions counts both, that a
// repeated screen collapses instead of self linking & that a fragment never
// anchors an issue.
func TestGetJourneyGraphAndroidNodeTypes(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 2, 10, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()
	sessionA, sessionB := uuid.NewString(), uuid.NewString()

	at := func(offset int) time.Time { return ts.Add(time.Duration(offset) * time.Second) }

	seedLifecycleActivityInSession(f.ctx, t, team, app, sessionA, event.LifecycleActivityTypeResumed, "HomeActivity", at(0))
	seedLifecycleFragmentInSession(f.ctx, t, team, app, sessionA, event.LifecycleFragmentTypeAttached, "CartFragment", at(10))
	// Crash lands while the fragment is on screen, it must still anchor to the
	// last activity.
	seedIssueEventInSession(f.ctx, t, team, app, sessionA, "exception", fpJourneyAndroid, false, at(15))
	// Same screen twice in a row, the collapse must drop the self edge.
	seedScreenViewInSession(f.ctx, t, team, app, sessionA, "CheckoutScreen", at(20))
	seedScreenViewInSession(f.ctx, t, team, app, sessionA, "CheckoutScreen", at(30))
	seedLifecycleActivityInSession(f.ctx, t, team, app, sessionA, event.LifecycleActivityTypeResumed, "PayActivity", at(40))

	// Session B repeats the first transition so its session count reaches 2.
	seedLifecycleActivityInSession(f.ctx, t, team, app, sessionB, event.LifecycleActivityTypeResumed, "HomeActivity", at(1))
	seedLifecycleFragmentInSession(f.ctx, t, team, app, sessionB, event.LifecycleFragmentTypeAttached, "CartFragment", at(11))

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", "")
	a := App{ID: f.app.ID, TeamId: f.teamID, OSNames: []string{"Android"}}

	g, err := a.GetJourneyGraph(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetJourneyGraph: %v", err)
	}

	nodes := map[string]bool{}
	for _, node := range g.Nodes {
		nodes[node] = true
	}
	for _, want := range []string{"CartFragment", "CheckoutScreen"} {
		if !nodes[want] {
			t.Errorf("node %s missing from %v", want, g.Nodes)
		}
	}

	var edge *JourneyEdge
	for i := range g.Edges {
		key := g.Edges[i].Source + "->" + g.Edges[i].Target
		if key == "CheckoutScreen->CheckoutScreen" {
			t.Errorf("self edge %s must collapse", key)
		}
		if key == "HomeActivity->CartFragment" {
			edge = &g.Edges[i]
		}
	}
	if edge == nil {
		t.Fatalf("edge HomeActivity->CartFragment missing from %+v", g.Edges)
	}
	if want := uint64(2); edge.Sessions != want {
		t.Errorf("edge HomeActivity->CartFragment sessions = %d, want %d", edge.Sessions, want)
	}

	if len(g.Issues) != 1 {
		t.Fatalf("issues = %+v, want exactly 1", g.Issues)
	}
	if want := "HomeActivity"; g.Issues[0].Node != want {
		t.Errorf("issue node = %s, want %s (fragments do not anchor)", g.Issues[0].Node, want)
	}
}

// TestGetJourneyGraphApple asserts the Apple family resolves view controllers,
// SwiftUI views & screen views into nodes, links them in order & anchors an
// issue to the view preceding it.
func TestGetJourneyGraphApple(t *testing.T) {
	f := newPlotFixture(t)
	ts := time.Date(2026, 3, 10, 10, 0, 0, 0, time.UTC)
	team, app := f.teamIDStr(), f.appIDStr()
	sessionID := uuid.NewString()

	at := func(offset int) time.Time { return ts.Add(time.Duration(offset) * time.Second) }

	seedLifecycleViewControllerInSession(f.ctx, t, team, app, sessionID, event.LifecycleViewControllerTypeViewDidAppear, "SettingsViewController", at(0))
	seedLifecycleSwiftUIInSession(f.ctx, t, team, app, sessionID, event.LifecycleSwiftUITypeOnAppear, "ProfileView", at(10))
	seedScreenViewInSession(f.ctx, t, team, app, sessionID, "HelpScreen", at(20))
	seedIssueEventInSession(f.ctx, t, team, app, sessionID, "exception", fpJourneyApple, false, at(25))

	af := f.appFilter(ts.Add(-time.Hour), ts.Add(time.Hour), "UTC", "")
	a := App{ID: f.app.ID, TeamId: f.teamID, OSNames: []string{"iOS"}}

	g, err := a.GetJourneyGraph(f.ctx, deps.RchPool, af)
	if err != nil {
		t.Fatalf("GetJourneyGraph: %v", err)
	}

	wantNodes := []string{"SettingsViewController", "ProfileView", "HelpScreen"}
	if len(g.Nodes) != len(wantNodes) {
		t.Fatalf("nodes = %v, want %v", g.Nodes, wantNodes)
	}
	for i := range wantNodes {
		if g.Nodes[i] != wantNodes[i] {
			t.Errorf("node %d = %s, want %s", i, g.Nodes[i], wantNodes[i])
		}
	}

	wantEdges := []string{"SettingsViewController->ProfileView", "ProfileView->HelpScreen"}
	if len(g.Edges) != len(wantEdges) {
		t.Fatalf("edges = %+v, want %v", g.Edges, wantEdges)
	}
	for i, want := range wantEdges {
		if got := g.Edges[i].Source + "->" + g.Edges[i].Target; got != want {
			t.Errorf("edge %d = %s, want %s", i, got, want)
		}
	}

	wantIssue := JourneyIssue{Node: "HelpScreen", Fingerprint: fpJourneyApple, Count: 1}
	if len(g.Issues) != 1 {
		t.Fatalf("issues = %+v, want %+v", g.Issues, wantIssue)
	}
	if g.Issues[0] != wantIssue {
		t.Errorf("issue = %+v, want %+v", g.Issues[0], wantIssue)
	}
}

// TestGetExceptionGroupsFromFingerprintsCountsFatalOnly asserts event_count
// counts fatal exceptions only, excluding handled and unhandled ones sharing
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
