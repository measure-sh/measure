//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"backend/libs/event"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Fingerprints must be exactly 32 chars to match the FixedString(32) group id.
const (
	fpJourneyHandlerCrash      = "fpjourneyhandlercrash00000000001"
	fpJourneyHandlerANR        = "fpjourneyhandleranr0000000000001"
	fpJourneyHandlerUnanchored = "fpjourneyhandlerunanchored000001"
)

// journeyResponse mirrors the JSON GetAppJourney emits. Issue lists stay raw so
// a serialised empty array is distinguishable from null.
type journeyResponse struct {
	TotalIssues uint64 `json:"totalIssues"`
	Nodes       []struct {
		ID     string `json:"id"`
		Issues struct {
			Crashes json.RawMessage `json:"crashes"`
			ANRs    json.RawMessage `json:"anrs"`
		} `json:"issues"`
	} `json:"nodes"`
	Links []struct {
		Source string `json:"source"`
		Target string `json:"target"`
		Value  uint64 `json:"value"`
	} `json:"links"`
}

// TestGetAppJourneyHandler drives the endpoint end to end over two sessions &
// asserts the JSON contract the dashboard depends on: unanchored issues stay
// counted, issue lists never serialise as null, issue counts are per node & a
// link carries its transition's session count.
func TestGetAppJourneyHandler(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "journey-handler-team")
	userID := uuid.New().String()
	seedUser(ctx, t, userID, "journey-handler@test.com")
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 30)

	team, app := teamID.String(), appID.String()
	sessionA, sessionB := uuid.NewString(), uuid.NewString()
	base := time.Now().UTC().Add(-time.Hour)
	at := func(offset int) time.Time { return base.Add(time.Duration(offset) * time.Second) }

	// Session A: Home -> Cart -> Pay, one crash on Home, one ANR on Cart. Pay
	// carries no issue at all.
	seedLifecycleActivityInSession(ctx, t, team, app, sessionA, event.LifecycleActivityTypeResumed, "HomeActivity", at(0))
	seedIssueEventInSession(ctx, t, team, app, sessionA, "exception", fpJourneyHandlerCrash, false, at(1))
	seedLifecycleActivityInSession(ctx, t, team, app, sessionA, event.LifecycleActivityTypeResumed, "CartActivity", at(2))
	seedIssueEventInSession(ctx, t, team, app, sessionA, "anr", fpJourneyHandlerANR, false, at(3))
	seedLifecycleActivityInSession(ctx, t, team, app, sessionA, event.LifecycleActivityTypeResumed, "PayActivity", at(4))

	// Session B repeats Home -> Cart so that transition spans two sessions. Its
	// first crash precedes every node, so it anchors nowhere. The same crash
	// fingerprint fires twice on Cart, making the group's global count 3 while
	// no single node's count is 3.
	seedIssueEventInSession(ctx, t, team, app, sessionB, "exception", fpJourneyHandlerUnanchored, false, at(0))
	seedLifecycleActivityInSession(ctx, t, team, app, sessionB, event.LifecycleActivityTypeResumed, "HomeActivity", at(1))
	seedLifecycleActivityInSession(ctx, t, team, app, sessionB, event.LifecycleActivityTypeResumed, "CartActivity", at(2))
	seedIssueEventInSession(ctx, t, team, app, sessionB, "exception", fpJourneyHandlerCrash, false, at(3))
	seedIssueEventInSession(ctx, t, team, app, sessionB, "exception", fpJourneyHandlerCrash, false, at(4))

	// Titles come from the group rows, issues without one get dropped.
	seedExceptionGroup(ctx, t, team, app, fpJourneyHandlerCrash)
	seedAnrGroup(ctx, t, team, app, fpJourneyHandlerANR)

	const timeFormat = "2006-01-02T15:04:05.000Z"
	from := base.Add(-time.Hour).Format(timeFormat)
	to := time.Now().UTC().Add(time.Hour).Format(timeFormat)

	c, w := newTestGinContext("GET", "/apps/"+app+"/journey?from="+from+"&to="+to, nil)
	c.Set("userId", userID)
	c.Params = gin.Params{{Key: "id", Value: app}}

	h.GetAppJourney(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var result journeyResponse
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// 1 crash on Home, 1 ANR on Cart, 2 crashes on Cart & the unanchored crash.
	if want := uint64(5); result.TotalIssues != want {
		t.Errorf("totalIssues = %d, want %d (the unanchored crash counts too)", result.TotalIssues, want)
	}

	nodes := map[string]journeyNodeIssues{}
	for _, node := range result.Nodes {
		nodes[node.ID] = journeyNodeIssues{crashes: node.Issues.Crashes, anrs: node.Issues.ANRs}
	}

	pay, ok := nodes["PayActivity"]
	if !ok {
		t.Fatalf("node PayActivity missing from %+v", result.Nodes)
	}
	// The dashboard types both as non optional arrays, null would break it.
	if got := string(pay.crashes); got != "[]" {
		t.Errorf("PayActivity issues.crashes = %s, want []", got)
	}
	if got := string(pay.anrs); got != "[]" {
		t.Errorf("PayActivity issues.anrs = %s, want []", got)
	}

	home, ok := nodes["HomeActivity"]
	if !ok {
		t.Fatalf("node HomeActivity missing from %+v", result.Nodes)
	}
	crashes := decodeJourneyIssues(t, home.crashes)
	if len(crashes) != 1 {
		t.Fatalf("HomeActivity crashes = %+v, want exactly 1", crashes)
	}
	if crashes[0].ID != fpJourneyHandlerCrash {
		t.Errorf("HomeActivity crash id = %s, want %s", crashes[0].ID, fpJourneyHandlerCrash)
	}
	// The group's global count is 3, only this node's own count is right.
	if want := uint64(1); crashes[0].Count != want {
		t.Errorf("HomeActivity crash count = %d, want %d (per node, not the group total)", crashes[0].Count, want)
	}

	links := map[string]uint64{}
	for _, link := range result.Links {
		links[link.Source+"->"+link.Target] = link.Value
	}
	value, ok := links["HomeActivity->CartActivity"]
	if !ok {
		t.Fatalf("link HomeActivity->CartActivity missing from %+v", result.Links)
	}
	if want := uint64(2); value != want {
		t.Errorf("link HomeActivity->CartActivity value = %d, want %d sessions", value, want)
	}
}

// journeyNodeIssues holds one node's raw issue lists.
type journeyNodeIssues struct {
	crashes json.RawMessage
	anrs    json.RawMessage
}

func decodeJourneyIssues(t *testing.T, raw json.RawMessage) (issues []journeyIssue) {
	t.Helper()
	if err := json.Unmarshal(raw, &issues); err != nil {
		t.Fatalf("unmarshal issues %s: %v", raw, err)
	}
	return
}
