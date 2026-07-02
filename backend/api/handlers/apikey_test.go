//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"backend/libs/cipher"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func mustRawAPIKey(t *testing.T, value string) string {
	t.Helper()
	checksum, err := cipher.ComputeChecksum([]byte(value))
	if err != nil {
		t.Fatalf("compute checksum: %v", err)
	}
	return fmt.Sprintf("%s_%s_%s", measure.APIKeyPrefix, value, *checksum)
}

func TestRotateApiKeyHandler(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid app id", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		c, w := newTestGinContext(http.MethodPatch, "/apps/invalid/apiKey", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: "invalid"}}

		h.RotateApiKey(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
		wantJSONContains(t, w, "error", "app id invalid or missing")
	})

	t.Run("app has no team", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New()
		c, w := newTestGinContext(http.MethodPatch, "/apps/"+appID.String()+"/apiKey", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		h.RotateApiKey(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
		}
		wantJSONContains(t, w, "error", "no team exists for app")
	})

	t.Run("no membership returns auth error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		appID := uuid.New()
		seedUser(ctx, t, userID, "noauth-apikey@test.com")
		seedTeam(ctx, t, teamID, "team")
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext(http.MethodPatch, "/apps/"+appID.String()+"/apiKey", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		h.RotateApiKey(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusInternalServerError)
		}
		wantJSONContains(t, w, "error", "couldn't perform authorization checks")
	})

	t.Run("all roles authz behavior", func(t *testing.T) {
		testCases := []struct {
			name       string
			role       string
			wantStatus int
		}{
			{name: "viewer forbidden", role: "viewer", wantStatus: http.StatusForbidden},
			{name: "developer forbidden", role: "developer", wantStatus: http.StatusForbidden},
			{name: "admin can rotate", role: "admin", wantStatus: http.StatusOK},
			{name: "owner can rotate", role: "owner", wantStatus: http.StatusOK},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				defer cleanupAll(ctx, t)

				userID := uuid.New().String()
				teamID := uuid.New()
				appID := uuid.New()
				seedUser(ctx, t, userID, fmt.Sprintf("%s-apikey@test.com", tc.role))
				seedTeam(ctx, t, teamID, "team")
				seedTeamMembership(ctx, t, teamID, userID, tc.role)
				seedApp(ctx, t, appID, teamID, 30)

				oldValue := "handler-old-active"
				oldRaw := mustRawAPIKey(t, oldValue)
				oldChecksum := oldRaw[len(measure.APIKeyPrefix)+1+len(oldValue)+1:]
				seedAPIKey(ctx, t, appID, measure.APIKeyPrefix, oldValue, oldChecksum, false, nil, time.Now().UTC().Add(-time.Hour))

				c, w := newTestGinContext(http.MethodPatch, "/apps/"+appID.String()+"/apiKey", nil)
				c.Set("userId", userID)
				c.Params = gin.Params{{Key: "id", Value: appID.String()}}

				h.RotateApiKey(c)

				if w.Code != tc.wantStatus {
					t.Fatalf("status = %d, want %d, body: %s", w.Code, tc.wantStatus, w.Body.String())
				}

				if tc.wantStatus == http.StatusForbidden {
					wantJSONContains(t, w, "error", "don't have permissions")
					return
				}

				wantJSON(t, w, "ok", "done")

				var resp map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
					t.Fatalf("unmarshal resp: %v", err)
				}
				apiKeyObj, ok := resp["api_key"].(map[string]any)
				if !ok {
					t.Fatalf("api_key missing in response")
				}
				if _, ok := apiKeyObj["key"].(string); !ok {
					t.Fatalf("api_key.key missing in response")
				}
				if gotRevoked, ok := apiKeyObj["revoked"].(bool); !ok || gotRevoked {
					t.Fatalf("api_key.revoked = %v, want false", apiKeyObj["revoked"])
				}
				if _, ok := apiKeyObj["created_at"].(string); !ok {
					t.Fatalf("api_key.created_at missing in response")
				}

				rows := getAPIKeysByAppID(ctx, t, appID)
				activeCount := 0
				for _, r := range rows {
					if !r.Revoked {
						activeCount++
					}
				}
				if activeCount != 1 {
					t.Fatalf("active key count = %d, want 1", activeCount)
				}
			})
		}
	})

	t.Run("missing user id in context returns auth error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "team")
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext(http.MethodPatch, "/apps/"+appID.String()+"/apiKey", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		h.RotateApiKey(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d", w.Code, http.StatusInternalServerError)
		}
		wantJSONContains(t, w, "error", "couldn't perform authorization checks")
	})
}
