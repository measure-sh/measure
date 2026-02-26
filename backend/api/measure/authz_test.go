//go:build integration

package measure

import (
	"backend/api/server"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func seedTeamAndMemberWithRole(t *testing.T, ctx context.Context, role string) (string, uuid.UUID) {
	t.Helper()

	userID := uuid.New().String()
	teamID := uuid.New()
	seedUser(ctx, t, userID, role+"-authz@test.com")
	seedTeam(ctx, t, teamID, testTeamName, true)
	seedTeamMembership(ctx, t, teamID, userID, role)
	return userID, teamID
}

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

// --------------------------------------------------------------------------
// Rank / JSON tests
// --------------------------------------------------------------------------

func TestLowerRoles(t *testing.T) {
	{
		expected := []rank{owner, admin, developer, viewer}
		result := owner.getLower()
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{admin, developer, viewer}
		result := admin.getLower()
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{developer, viewer}
		result := developer.getLower()
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{viewer}
		result := viewer.getLower()
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
}

func TestRank_ValidAndString(t *testing.T) {
	tests := []struct {
		name      string
		role      rank
		wantValid bool
		wantStr   string
	}{
		{name: "owner", role: owner, wantValid: true, wantStr: "owner"},
		{name: "admin", role: admin, wantValid: true, wantStr: "admin"},
		{name: "developer", role: developer, wantValid: true, wantStr: "developer"},
		{name: "viewer", role: viewer, wantValid: true, wantStr: "viewer"},
		{name: "unknown", role: unknown, wantValid: false, wantStr: "unknown"},
		{name: "invalid", role: rank(100), wantValid: false, wantStr: "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.Valid(); got != tt.wantValid {
				t.Fatalf("Valid() = %v, want %v", got, tt.wantValid)
			}
			if got := tt.role.String(); got != tt.wantStr {
				t.Fatalf("String() = %q, want %q", got, tt.wantStr)
			}
		})
	}
}

func TestRankUnmarshalJSON(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    rank
		wantErr bool
	}{
		{name: "owner", input: `"owner"`, want: owner},
		{name: "admin", input: `"admin"`, want: admin},
		{name: "developer", input: `"developer"`, want: developer},
		{name: "viewer", input: `"viewer"`, want: viewer},
		{name: "unknown role string maps to unknown", input: `"something_else"`, want: unknown},
		{name: "invalid json type", input: `123`, wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var r rank
			err := json.Unmarshal([]byte(tc.input), &r)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if r != tc.want {
				t.Fatalf("rank = %v, want %v", r, tc.want)
			}
		})
	}
}

func TestRoleMap_CoversAllKnownRoles(t *testing.T) {
	tests := []struct {
		role string
		want rank
	}{
		{role: "owner", want: owner},
		{role: "admin", want: admin},
		{role: "developer", want: developer},
		{role: "viewer", want: viewer},
		{role: "unknown", want: unknown},
	}

	for _, tt := range tests {
		t.Run(tt.role, func(t *testing.T) {
			if got := roleMap[tt.role]; got != tt.want {
				t.Fatalf("roleMap[%q] = %v, want %v", tt.role, got, tt.want)
			}
		})
	}
}

// --------------------------------------------------------------------------
// Scope map and role-derivation tests
// --------------------------------------------------------------------------

func TestSameOrLowerRoleFromScope(t *testing.T) {
	{
		expected := []rank{owner, admin, developer, viewer}
		result := ScopeTeamInviteSameOrLower.getRolesSameOrLower(owner)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{owner, admin, developer, viewer}
		result := ScopeTeamChangeRoleSameOrLower.getRolesSameOrLower(owner)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{admin, developer, viewer}
		result := ScopeTeamInviteSameOrLower.getRolesSameOrLower(admin)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{admin, developer, viewer}
		result := ScopeTeamChangeRoleSameOrLower.getRolesSameOrLower(admin)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{developer, viewer}
		result := ScopeTeamInviteSameOrLower.getRolesSameOrLower(developer)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{developer, viewer}
		result := ScopeTeamChangeRoleSameOrLower.getRolesSameOrLower(developer)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{viewer}
		result := ScopeTeamInviteSameOrLower.getRolesSameOrLower(viewer)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{}
		result := ScopeTeamChangeRoleSameOrLower.getRolesSameOrLower(viewer)
		if len(expected) != len(result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
}

func TestScopeMap_AppScopes(t *testing.T) {
	tests := []struct {
		name           string
		role           rank
		wantAppAll     bool
		wantAppRead    bool
		wantBillingAll bool
		wantTeamAll    bool
	}{
		{name: "owner", role: owner, wantAppAll: true, wantAppRead: false, wantBillingAll: true, wantTeamAll: true},
		{name: "admin", role: admin, wantAppAll: true, wantAppRead: false, wantBillingAll: true, wantTeamAll: false},
		{name: "developer", role: developer, wantAppAll: false, wantAppRead: true, wantBillingAll: false, wantTeamAll: false},
		{name: "viewer", role: viewer, wantAppAll: false, wantAppRead: true, wantBillingAll: false, wantTeamAll: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			roleScopes := scopeMap[tt.role]
			if got := slices.Contains(roleScopes, *ScopeAppAll); got != tt.wantAppAll {
				t.Fatalf("ScopeAppAll = %v, want %v", got, tt.wantAppAll)
			}
			if got := slices.Contains(roleScopes, *ScopeAppRead); got != tt.wantAppRead {
				t.Fatalf("ScopeAppRead = %v, want %v", got, tt.wantAppRead)
			}
			if got := slices.Contains(roleScopes, *ScopeBillingAll); got != tt.wantBillingAll {
				t.Fatalf("ScopeBillingAll = %v, want %v", got, tt.wantBillingAll)
			}
			if got := slices.Contains(roleScopes, *ScopeTeamAll); got != tt.wantTeamAll {
				t.Fatalf("ScopeTeamAll = %v, want %v", got, tt.wantTeamAll)
			}
		})
	}
}

func TestScopeMap_TeamInviteAndAlertScopes(t *testing.T) {
	tests := []struct {
		name                    string
		role                    rank
		wantTeamInviteSameOrLow bool
		wantTeamChangeSameOrLow bool
		wantAlertAll            bool
		wantAlertRead           bool
	}{
		{name: "owner", role: owner, wantTeamInviteSameOrLow: false, wantTeamChangeSameOrLow: false, wantAlertAll: true, wantAlertRead: false},
		{name: "admin", role: admin, wantTeamInviteSameOrLow: true, wantTeamChangeSameOrLow: true, wantAlertAll: true, wantAlertRead: false},
		{name: "developer", role: developer, wantTeamInviteSameOrLow: true, wantTeamChangeSameOrLow: true, wantAlertAll: true, wantAlertRead: false},
		{name: "viewer", role: viewer, wantTeamInviteSameOrLow: true, wantTeamChangeSameOrLow: false, wantAlertAll: false, wantAlertRead: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			roleScopes := scopeMap[tt.role]
			if got := slices.Contains(roleScopes, *ScopeTeamInviteSameOrLower); got != tt.wantTeamInviteSameOrLow {
				t.Fatalf("ScopeTeamInviteSameOrLower = %v, want %v", got, tt.wantTeamInviteSameOrLow)
			}
			if got := slices.Contains(roleScopes, *ScopeTeamChangeRoleSameOrLower); got != tt.wantTeamChangeSameOrLow {
				t.Fatalf("ScopeTeamChangeRoleSameOrLower = %v, want %v", got, tt.wantTeamChangeSameOrLow)
			}
			if got := slices.Contains(roleScopes, *ScopeAlertAll); got != tt.wantAlertAll {
				t.Fatalf("ScopeAlertAll = %v, want %v", got, tt.wantAlertAll)
			}
			if got := slices.Contains(roleScopes, *ScopeAlertRead); got != tt.wantAlertRead {
				t.Fatalf("ScopeAlertRead = %v, want %v", got, tt.wantAlertRead)
			}
		})
	}
}

func TestGetRolesSameOrLower_NonTeamScopesReturnEmpty(t *testing.T) {
	for _, tc := range []struct {
		name  string
		scope scope
	}{
		{name: "app read", scope: *ScopeAppRead},
		{name: "app all", scope: *ScopeAppAll},
		{name: "team read", scope: *ScopeTeamRead},
		{name: "billing read", scope: *ScopeBillingRead},
		{name: "alert all", scope: *ScopeAlertAll},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.scope.getRolesSameOrLower(owner); len(got) != 0 {
				t.Fatalf("expected empty roles, got %v", got)
			}
		})
	}
}

// --------------------------------------------------------------------------
// PerformAuthz tests
// --------------------------------------------------------------------------

func TestPerformAuthzMatrix(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name      string
		role      string
		scope     scope
		wantAllow bool
	}{
		{name: "owner app all", role: "owner", scope: *ScopeAppAll, wantAllow: true},
		{name: "admin app all", role: "admin", scope: *ScopeAppAll, wantAllow: true},
		{name: "developer app all denied", role: "developer", scope: *ScopeAppAll, wantAllow: false},
		{name: "viewer app all denied", role: "viewer", scope: *ScopeAppAll, wantAllow: false},
		{name: "developer app read allowed", role: "developer", scope: *ScopeAppRead, wantAllow: true},
		{name: "viewer app read allowed", role: "viewer", scope: *ScopeAppRead, wantAllow: true},
		{name: "viewer billing all denied", role: "viewer", scope: *ScopeBillingAll, wantAllow: false},
		{name: "developer billing read allowed", role: "developer", scope: *ScopeBillingRead, wantAllow: true},
		{name: "owner team all allowed", role: "owner", scope: *ScopeTeamAll, wantAllow: true},
		{name: "admin team all denied", role: "admin", scope: *ScopeTeamAll, wantAllow: false},
		{name: "viewer team read allowed", role: "viewer", scope: *ScopeTeamRead, wantAllow: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, teamID := seedTeamAndMemberWithRole(t, ctx, tc.role)

			allowed, err := PerformAuthz(userID, teamID.String(), tc.scope)
			if err != nil {
				t.Fatalf("PerformAuthz returned error: %v", err)
			}
			if allowed != tc.wantAllow {
				t.Fatalf("allowed = %v, want %v", allowed, tc.wantAllow)
			}
		})
	}
}

func TestPerformAuthzErrorPaths(t *testing.T) {
	ctx := context.Background()

	t.Run("unknown role when membership missing", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, "no-membership-authz@test.com")
		seedTeam(ctx, t, teamID, "team", true)

		allowed, err := PerformAuthz(userID, teamID.String(), *ScopeAppRead)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if err.Error() != "received 'unknown' role" {
			t.Fatalf("err = %q, want %q", err.Error(), "received 'unknown' role")
		}
		if allowed {
			t.Fatal("allowed = true, want false")
		}
	})

	t.Run("invalid user id returns query error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "team", true)

		allowed, err := PerformAuthz("not-a-uuid", teamID.String(), *ScopeAppRead)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if allowed {
			t.Fatal("allowed = true, want false")
		}
	})
}

// --------------------------------------------------------------------------
// Handler: GetAuthzRoles
// --------------------------------------------------------------------------

func TestGetAuthzRoles_BillingDisabled(t *testing.T) {
	ctx := context.Background()

	for _, role := range []string{"owner", "admin", "developer", "viewer"} {
		role := role
		t.Run(role, func(t *testing.T) {
			defer cleanupAll(ctx, t)

			orig := server.Server.Config.BillingEnabled
			server.Server.Config.BillingEnabled = false
			defer func() { server.Server.Config.BillingEnabled = orig }()

			userID, teamID := seedTeamAndMemberWithRole(t, ctx, role)
			c, w := newGetAuthzRolesContext(userID, teamID)

			GetAuthzRoles(c)

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

			GetAuthzRoles(c)

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

		GetAuthzRoles(c)

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
		seedTeam(ctx, t, teamID, testTeamName, true)

		c, w := newGetAuthzRolesContext(userID, teamID)
		GetAuthzRoles(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusInternalServerError, w.Body.String())
		}
		wantJSONContains(t, w, "error", "couldn't perform authorization checks")
	})

	t.Run("invalid user id returns 500", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, testTeamName, true)

		c, w := newGetAuthzRolesContext("not-a-uuid", teamID)
		GetAuthzRoles(c)

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
	seedTeam(ctx, t, teamID, testTeamName, true)
	seedTeamMembership(ctx, t, teamID, userID, "owner")
	seedTeamMembership(ctx, t, teamID, otherID, "viewer")

	c, w := newGetAuthzRolesContext(userID, teamID)
	GetAuthzRoles(c)

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
