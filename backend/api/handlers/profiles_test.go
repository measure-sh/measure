//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"backend/testinfra"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func newProfilesOverviewContext(callerID string, appID uuid.UUID, rawQuery string) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/profiles?"+rawQuery, nil)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	return c, w
}

var profilesOverviewTestTime = time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)

func profilesOverviewTimeRangeQuery() string {
	from := profilesOverviewTestTime.Add(-time.Hour).Format("2006-01-02T15:04:05.000Z")
	to := profilesOverviewTestTime.Add(time.Hour).Format("2006-01-02T15:04:05.000Z")
	return "from=" + from + "&to=" + to
}

func TestGetProfilesOverview(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
	appID := uuid.New()
	seedApp(ctx, t, appID, teamID, 90)

	anrSessionID := uuid.New()
	seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type: "profile", SessionID: anrSessionID.String(), Timestamp: profilesOverviewTestTime,
		ProfileTrigger: "anr", ProfileFormat: "perfetto_trace",
	})
	seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
		Type: "profile", SessionID: uuid.NewString(), Timestamp: profilesOverviewTestTime,
		ProfileTrigger: "app_fully_drawn", ProfileFormat: "perfetto_trace",
	})

	t.Run("filters profiles by trigger", func(t *testing.T) {
		c, w := newProfilesOverviewContext(ownerID, appID, profilesOverviewTimeRangeQuery()+"&filter_expr=profile_trigger:in:[anr]")
		h.GetProfilesOverview(c)

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
		if len(body.Results) != 1 || body.Results[0].SessionID != anrSessionID.String() {
			t.Errorf("results = %v, want only the ANR profile's session %q", body.Results, anrSessionID.String())
		}
	})
}
