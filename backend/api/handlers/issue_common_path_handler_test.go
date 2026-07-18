//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestGetCrashGroupCommonPathHandler(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid app id", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		c, w := newTestGinContext("GET", "/apps/not-a-uuid/crashGroups/fp1/path", nil)
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}, {Key: "crashGroupId", Value: "fp1"}}

		h.GetCrashGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("missing crashGroupId", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/crashGroups//path", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		h.GetCrashGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("app with no team", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		// Use a valid UUID that doesn't exist in the DB
		appID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/crashGroups/fp1/path", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "crashGroupId", Value: "fp1"}}

		h.GetCrashGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("user not authorized", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-handler-team")
		ownerID := uuid.New().String()
		seedUser(ctx, t, ownerID, "cp-owner@test.com")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		// a different user who is not a team member
		otherID := uuid.New().String()
		seedUser(ctx, t, otherID, "cp-other@test.com")

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/crashGroups/fp1/path", nil)
		c.Set("userId", otherID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "crashGroupId", Value: "fp1"}}

		h.GetCrashGroupCommonPath(c)

		if w.Code != http.StatusForbidden {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusForbidden, w.Body.String())
		}
	})

	t.Run("nonexistent crash group", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-handler-team2")
		userID := uuid.New().String()
		seedUser(ctx, t, userID, "cp-user2@test.com")
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/crashGroups/fp-nonexistent/path", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "crashGroupId", Value: "fp-nonexistent"}}

		h.GetCrashGroupCommonPath(c)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
	})

	t.Run("valid call with seeded crash group", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-handler-team3")
		userID := uuid.New().String()
		seedUser(ctx, t, userID, "cp-user3@test.com")
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-cp-handler-crash-12345678"
		th.SeedExceptionGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/crashGroups/"+fingerprint+"/path", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "crashGroupId", Value: fingerprint}}

		h.GetCrashGroupCommonPath(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if _, ok := result["sessions_analyzed"]; !ok {
			t.Error("response missing sessions_analyzed field")
		}
		if _, ok := result["steps"]; !ok {
			t.Error("response missing steps field")
		}
	})
}

func TestGetANRGroupCommonPathHandler(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid app id", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		c, w := newTestGinContext("GET", "/apps/not-a-uuid/anrGroups/fp1/path", nil)
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}, {Key: "anrGroupId", Value: "fp1"}}

		h.GetANRGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("missing anrGroupId", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/anrGroups//path", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		h.GetANRGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("valid call with seeded ANR group", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-anr-handler-team")
		userID := uuid.New().String()
		seedUser(ctx, t, userID, "cp-anr-user@test.com")
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-cp-handler-anr-123456789"
		th.SeedAnrGroup(ctx, t, teamID.String(), appID.String(), fingerprint)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/anrGroups/"+fingerprint+"/path", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "anrGroupId", Value: fingerprint}}

		h.GetANRGroupCommonPath(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if _, ok := result["sessions_analyzed"]; !ok {
			t.Error("response missing sessions_analyzed field")
		}
		if _, ok := result["steps"]; !ok {
			t.Error("response missing steps field")
		}
	})
}
