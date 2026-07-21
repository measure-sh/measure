//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// seedNormalSession seeds a session with a session_start event plus a
// navigation event, so it survives the "session_start-only" Having filter
// on the sessions CTE.
func seedNormalSession(ctx context.Context, t *testing.T, teamID, appID, sessionID, userID string, ts time.Time) {
	t.Helper()
	seedSessionStartEvent(ctx, t, teamID, appID, sessionID, userID, ts)
	seedNavigationEventInSession(ctx, t, teamID, appID, sessionID, "home", ts.Add(time.Second))
}

func newSessionsOverviewContext(callerID string, appID uuid.UUID, rawQuery string) (*gin.Context, *httptest.ResponseRecorder) {
	path := "/apps/" + appID.String() + "/sessions"
	if rawQuery != "" {
		path += "?" + rawQuery
	}
	c, w := newTestGinContext("GET", path, nil)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	return c, w
}

func newSessionsPlotInstancesContext(callerID string, appID uuid.UUID, rawQuery string) (*gin.Context, *httptest.ResponseRecorder) {
	path := "/apps/" + appID.String() + "/sessions/plots/instances"
	if rawQuery != "" {
		path += "?" + rawQuery
	}
	c, w := newTestGinContext("GET", path, nil)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	return c, w
}

// fixed reference instant for seeded session timestamps, matched by an
// explicit from/to query range rather than relying on real wall-clock "now"
// & the handler's default lookback window.
var sessionsOverviewTestTime = time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

func sessionsOverviewTimeRangeQuery() string {
	from := sessionsOverviewTestTime.Add(-time.Hour).Format("2006-01-02T15:04:05.000Z")
	to := sessionsOverviewTestTime.Add(time.Hour).Format("2006-01-02T15:04:05.000Z")
	return "from=" + from + "&to=" + to
}

func TestGetSessionsOverview(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 90)

	now := sessionsOverviewTestTime
	sessionStartOnlyID := uuid.New()
	normalSessionID := uuid.New()
	seedSessionStartEvent(ctx, t, teamID.String(), appID.String(), sessionStartOnlyID.String(), "user-a", now)
	seedNormalSession(ctx, t, teamID.String(), appID.String(), normalSessionID.String(), "user-b", now)
	c, w := newSessionsOverviewContext(ownerID, appID, sessionsOverviewTimeRangeQuery())
	h.GetSessionsOverview(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
	}

	var body struct {
		Results []struct {
			SessionID string `json:"session_id"`
		} `json:"results"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	var gotIDs []string
	for _, r := range body.Results {
		gotIDs = append(gotIDs, r.SessionID)
	}

	foundNormal := false
	for _, id := range gotIDs {
		if id == normalSessionID.String() {
			foundNormal = true
		}
		if id == sessionStartOnlyID.String() {
			t.Errorf("results contains session_start-only session %q, want it filtered out", id)
		}
	}
	if !foundNormal {
		t.Errorf("results = %v, want to contain normal session %q", gotIDs, normalSessionID.String())
	}
}

func TestGetSessionsOverviewPlotInstances(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 90)

	now := sessionsOverviewTestTime
	sessionStartOnlyID := uuid.New()
	normalSessionID := uuid.New()
	seedSessionStartEvent(ctx, t, teamID.String(), appID.String(), sessionStartOnlyID.String(), "user-a", now)
	seedNormalSession(ctx, t, teamID.String(), appID.String(), normalSessionID.String(), "user-b", now)
	c, w := newSessionsPlotInstancesContext(ownerID, appID, "timezone=Etc/UTC&"+sessionsOverviewTimeRangeQuery())
	h.GetSessionsOverviewPlotInstances(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
	}

	var body []struct {
		ID   string `json:"id"`
		Data []struct {
			Datetime  string `json:"datetime"`
			Instances uint64 `json:"instances"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	var totalInstances uint64
	for _, entry := range body {
		for _, d := range entry.Data {
			totalInstances += d.Instances
		}
	}

	// only the normal session counts; the session_start-only session must
	// not inflate the instance count.
	if totalInstances != 1 {
		t.Errorf("total instances = %d, want 1", totalInstances)
	}
}
