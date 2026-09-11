//go:build integration

package handlers

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func appNameInDB(ctx context.Context, t *testing.T, appID uuid.UUID) string {
	t.Helper()
	var name string
	if err := th.PgPool.QueryRow(ctx,
		`SELECT app_name FROM apps WHERE id = $1`, appID).Scan(&name); err != nil {
		t.Fatalf("read app name: %v", err)
	}
	return name
}

func newRenameAppContext(callerID string, appID uuid.UUID, body string) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := newTestGinContext("PATCH", "/apps/"+appID.String()+"/rename", bytes.NewBufferString(body))
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: appID.String()}}
	return c, w
}

func TestRenameApp(t *testing.T) {
	ctx := context.Background()

	t.Run("owner can rename an app", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)
		seedAPIKey(ctx, t, appID, "msrsh", "key-value", "checksum", false, nil, time.Now())

		c, w := newRenameAppContext(ownerID, appID, `{"name":"renamed-app"}`)
		h.RenameApp(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if got := appNameInDB(ctx, t, appID); got != "renamed-app" {
			t.Errorf("app name = %q, want renamed-app", got)
		}
	})

	t.Run("missing name gets 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		c, w := newRenameAppContext(ownerID, appID, `{}`)
		h.RenameApp(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("a body-supplied id cannot redirect the rename", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)

		// an app in a team the caller has nothing to do with
		otherTeamID := uuid.New()
		seedTeam(ctx, t, otherTeamID, "other-team")
		victimAppID := uuid.New()
		seedApp(ctx, t, victimAppID, otherTeamID, 90)

		body := fmt.Sprintf(`{"id":%q,"name":"hacked"}`, victimAppID)
		c, w := newRenameAppContext(ownerID, appID, body)
		h.RenameApp(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if got := appNameInDB(ctx, t, appID); got != "hacked" {
			t.Errorf("url app name = %q, want hacked (url id wins)", got)
		}
		if got := appNameInDB(ctx, t, victimAppID); got == "hacked" {
			t.Errorf("victim app was renamed via body id, want untouched")
		}
	})
}
