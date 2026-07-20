//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// seedSessionStartEvent inserts a single "session_start" event with an
// explicit attribute.user_id. SeedEventRows has no user_id field, so this
// bypasses it with a raw insert; sessions_index_mv still picks the row up
// like any other events insert.
func seedSessionStartEvent(ctx context.Context, t *testing.T, teamID, appID, sessionID, userID string, ts time.Time) {
	t.Helper()
	query := fmt.Sprintf(
		`INSERT INTO measure.events (id, type, session_id, app_id, team_id, timestamp, user_triggered, `+
			"`attribute.installation_id`, `attribute.app_version`, `attribute.app_build`, "+
			"`attribute.app_unique_id`, `attribute.measure_sdk_version`, `attribute.user_id`) "+
			`VALUES ('%s', 'session_start', '%s', '%s', '%s', '%s', false, '%s', 'v1', '1', 'com.test', '0.1', '%s')`,
		uuid.New().String(), sessionID, appID, teamID,
		ts.UTC().Format("2006-01-02 15:04:05"), uuid.New().String(), userID)
	if err := th.ChConn.Exec(ctx, query); err != nil {
		t.Fatalf("seed session_start event: %v", err)
	}
}

func newGetSessionContext(callerID string, appID, sessionID uuid.UUID) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/sessions/"+sessionID.String(), nil)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "sessionId", Value: sessionID.String()}}
	return c, w
}

func TestGetSession(t *testing.T) {
	ctx := context.Background()

	t.Run("session whose only row is session_start still returns its attribute", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		sessionID := uuid.New()
		userID := "user-" + sessionID.String()[:8]
		seedSessionStartEvent(ctx, t, teamID.String(), appID.String(), sessionID.String(), userID, time.Now())

		c, w := newGetSessionContext(ownerID, appID, sessionID)
		h.GetSession(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}

		var body struct {
			Attribute *struct {
				UserID string `json:"user_id"`
			} `json:"attribute"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if body.Attribute == nil {
			t.Fatalf("attribute = nil, want non-nil")
		}
		if body.Attribute.UserID != userID {
			t.Errorf("attribute.user_id = %q, want %q", body.Attribute.UserID, userID)
		}
	})

	t.Run("session with no events & no spans returns 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		sessionID := uuid.New()

		c, w := newGetSessionContext(ownerID, appID, sessionID)
		h.GetSession(c)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "error", "does not exist")
	})
}
