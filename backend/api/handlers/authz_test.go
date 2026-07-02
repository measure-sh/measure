//go:build integration

package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func newGetAuthzRolesContext(userID string, teamID uuid.UUID) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/authz", nil)
	c.Set("userId", userID)
	c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
	return c, w
}

func decodeJSONMap(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	return body
}

func TestGetAuthzRoles_BillingDisabled(t *testing.T) {
	ctx := context.Background()

	for _, role := range []string{"owner", "admin", "developer", "viewer"} {
		role := role
		t.Run(role, func(t *testing.T) {
			defer cleanupAll(ctx, t)

			orig := deps.Config.BillingEnabled
			deps.Config.BillingEnabled = false
			defer func() { deps.Config.BillingEnabled = orig }()

			userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)
			c, w := newGetAuthzRolesContext(userID, teamID)

			h.GetAuthzRoles(c)

			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
			}
			wantJSON(t, w, "can_change_billing", false)
			if role == "owner" {
				wantJSON(t, w, "can_create_app", true)
				wantJSON(t, w, "can_rename_team", true)
				wantJSON(t, w, "can_manage_slack", true)
				wantJSON(t, w, "can_change_app_threshold_prefs", true)
			} else {
				wantJSON(t, w, "can_change_app_threshold_prefs", role == "admin")
			}
		})
	}
}

func TestGetAuthzRoles_BillingEnabled(t *testing.T) {
	ctx := context.Background()

	for _, tc := range []struct {
		role            string
		wantBilling     bool
		wantRenameTeam  bool
		wantManageSlack bool
		wantPrefs       bool
	}{
		{role: "owner", wantBilling: true, wantRenameTeam: true, wantManageSlack: true, wantPrefs: true},
		{role: "admin", wantBilling: true, wantRenameTeam: false, wantManageSlack: false, wantPrefs: true},
		{role: "developer", wantBilling: false, wantRenameTeam: false, wantManageSlack: false, wantPrefs: false},
		{role: "viewer", wantBilling: false, wantRenameTeam: false, wantManageSlack: false, wantPrefs: false},
	} {
		tc := tc
		t.Run(tc.role, func(t *testing.T) {
			defer cleanupAll(ctx, t)

			userID, teamID := seedTeamAndMemberWithRole(t, ctx, tc.role)
			c, w := newGetAuthzRolesContext(userID, teamID)

			h.GetAuthzRoles(c)

			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
			}
			wantJSON(t, w, "can_change_billing", tc.wantBilling)
			wantJSON(t, w, "can_rename_team", tc.wantRenameTeam)
			wantJSON(t, w, "can_manage_slack", tc.wantManageSlack)
			wantJSON(t, w, "can_change_app_threshold_prefs", tc.wantPrefs)

			switch tc.role {
			case "owner", "admin":
				wantJSON(t, w, "can_create_app", true)
				wantJSON(t, w, "can_rename_app", true)
				wantJSON(t, w, "can_change_retention", true)
				wantJSON(t, w, "can_rotate_api_key", true)
				wantJSON(t, w, "can_write_sdk_config", true)
			case "developer", "viewer":
				wantJSON(t, w, "can_create_app", false)
				wantJSON(t, w, "can_rename_app", false)
				wantJSON(t, w, "can_change_retention", false)
				wantJSON(t, w, "can_rotate_api_key", false)
				wantJSON(t, w, "can_write_sdk_config", false)
			}
		})
	}
}

func TestGetAuthzRoles_ErrorPaths(t *testing.T) {
	ctx := context.Background()

	t.Run("invalid team id returns 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		c, w := newTestGinContext("GET", "/teams/not-a-uuid/authz", nil)
		c.Set("userId", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}

		h.GetAuthzRoles(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusBadRequest, w.Body.String())
		}
		wantJSONContains(t, w, "error", "team id invalid or missing")
	})

	t.Run("missing membership returns 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, "authz-missing-membership@test.com")
		seedTeam(ctx, t, teamID, testTeamName)

		c, w := newGetAuthzRolesContext(userID, teamID)
		h.GetAuthzRoles(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
		wantJSONContains(t, w, "error", "couldn't perform authorization checks")
	})

	t.Run("invalid user id returns 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName)

		c, w := newGetAuthzRolesContext("not-a-uuid", teamID)
		h.GetAuthzRoles(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
		wantJSONContains(t, w, "error", "couldn't perform authorization checks")
	})
}

func TestGetAuthzRoles_ResponseContract(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	userID := uuid.New().String()
	otherID := uuid.New().String()
	teamID := uuid.New()

	seedUser(ctx, t, userID, "owner-authz-contract@test.com")
	seedUser(ctx, t, otherID, "viewer-authz-contract@test.com")
	seedTeam(ctx, t, teamID, testTeamName)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedTeamMembership(ctx, t, teamID, otherID, "viewer")

	c, w := newGetAuthzRolesContext(userID, teamID)
	h.GetAuthzRoles(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	body := decodeJSONMap(t, w)

	inviteRoles, ok := body["can_invite_roles"].([]any)
	if !ok {
		t.Fatalf("can_invite_roles missing or wrong type: %#v", body["can_invite_roles"])
	}
	if len(inviteRoles) == 0 {
		t.Fatal("can_invite_roles should not be empty for owner")
	}

	members, ok := body["members"].([]any)
	if !ok || len(members) == 0 {
		t.Fatalf("members missing or empty: %#v", body["members"])
	}

	firstMember, ok := members[0].(map[string]any)
	if !ok {
		t.Fatalf("member has wrong shape: %#v", members[0])
	}
	authzObj, ok := firstMember["authz"].(map[string]any)
	if !ok {
		t.Fatalf("member authz missing or wrong type: %#v", firstMember["authz"])
	}

	if _, ok := authzObj["current_user_assignable_roles_for_member"]; !ok {
		t.Fatal("current_user_assignable_roles_for_member missing in member authz")
	}
	if _, ok := authzObj["current_user_can_remove_member"]; !ok {
		t.Fatal("current_user_can_remove_member missing in member authz")
	}
}
