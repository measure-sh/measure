//go:build integration

package measure

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// --------------------------------------------------------------------------
// Gin handler tests: GetErrorGroupCommonPath
// --------------------------------------------------------------------------

func TestGetErrorGroupCommonPathHandler(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid app id", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		c, w := newTestGinContext("GET", "/apps/not-a-uuid/errorGroups/fp1/path", nil)
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}, {Key: "errorGroupId", Value: "fp1"}}

		GetErrorGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("missing errorGroupId", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/errorGroups//path", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}}

		GetErrorGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("app with no team", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		appID := uuid.New()
		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/errorGroups/fp1/path", nil)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "errorGroupId", Value: "fp1"}}

		GetErrorGroupCommonPath(c)

		if w.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
	})

	t.Run("user not authorized", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-error-handler-team")
		ownerID := uuid.New().String()
		seedUser(ctx, t, ownerID, "cp-err-owner@test.com")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		otherID := uuid.New().String()
		seedUser(ctx, t, otherID, "cp-err-other@test.com")

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/errorGroups/fp1/path", nil)
		c.Set("userId", otherID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "errorGroupId", Value: "fp1"}}

		GetErrorGroupCommonPath(c)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
	})

	t.Run("unknown fingerprint returns empty result not 500", func(t *testing.T) {
		// GroupTypeError skips the existence check, so a bogus fingerprint
		// should yield a 200 with sessions_analyzed=0 (not a 500 like the
		// crash/ANR variants).
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-error-unknown-team")
		userID := uuid.New().String()
		seedUser(ctx, t, userID, "cp-err-unknown@test.com")
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/errorGroups/fp-bogus/path", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "errorGroupId", Value: "fp-bogus"}}

		GetErrorGroupCommonPath(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []any  `json:"steps"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.SessionsAnalyzed != 0 {
			t.Errorf("sessions_analyzed = %d, want 0", result.SessionsAnalyzed)
		}
	})

	t.Run("valid call with exception fingerprint produces non-zero result", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-error-exception-team")
		userID := uuid.New().String()
		seedUser(ctx, t, userID, "cp-err-exception@test.com")
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-cp-error-exception-1234567"
		sessionID := uuid.New().String()
		now := time.Now().UTC()
		seedEventWithSession(ctx, t, teamID.String(), appID.String(), sessionID, now.Add(-2*time.Second))
		seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "exception", fingerprint, false, now)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/errorGroups/"+fingerprint+"/path", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "errorGroupId", Value: fingerprint}}

		GetErrorGroupCommonPath(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []any  `json:"steps"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.SessionsAnalyzed < 1 {
			t.Errorf("sessions_analyzed = %d, want >= 1", result.SessionsAnalyzed)
		}
	})

	t.Run("valid call with handled exception fingerprint produces non-zero result", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-error-handled-team")
		userID := uuid.New().String()
		seedUser(ctx, t, userID, "cp-err-handled@test.com")
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-cp-error-handled-12345678"
		sessionID := uuid.New().String()
		now := time.Now().UTC()
		seedEventWithSession(ctx, t, teamID.String(), appID.String(), sessionID, now.Add(-2*time.Second))
		seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "exception", fingerprint, true, now)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/errorGroups/"+fingerprint+"/path", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "errorGroupId", Value: fingerprint}}

		GetErrorGroupCommonPath(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []any  `json:"steps"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.SessionsAnalyzed < 1 {
			t.Errorf("sessions_analyzed = %d, want >= 1", result.SessionsAnalyzed)
		}
	})

	t.Run("valid call with ANR fingerprint produces non-zero result", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "cp-error-anr-team")
		userID := uuid.New().String()
		seedUser(ctx, t, userID, "cp-err-anr@test.com")
		seedTeamMembership(ctx, t, teamID, userID, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 30)

		fingerprint := "fp-cp-error-anr-123456789012"
		sessionID := uuid.New().String()
		now := time.Now().UTC()
		seedEventWithSession(ctx, t, teamID.String(), appID.String(), sessionID, now.Add(-2*time.Second))
		seedIssueEventInSession(ctx, t, teamID.String(), appID.String(), sessionID, "anr", fingerprint, false, now)

		c, w := newTestGinContext("GET", "/apps/"+appID.String()+"/errorGroups/"+fingerprint+"/path", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: appID.String()}, {Key: "errorGroupId", Value: fingerprint}}

		GetErrorGroupCommonPath(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
		}

		var result struct {
			SessionsAnalyzed uint64 `json:"sessions_analyzed"`
			Steps            []any  `json:"steps"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if result.SessionsAnalyzed < 1 {
			t.Errorf("sessions_analyzed = %d, want >= 1", result.SessionsAnalyzed)
		}
	})
}
