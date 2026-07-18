//go:build integration

package measure

import (
	"context"
	"encoding/json"
	"reflect"
	"slices"
	"testing"

	"github.com/google/uuid"
)

func seedTeamAndMemberWithRole(t *testing.T, ctx context.Context, role string) (string, uuid.UUID) {
	t.Helper()

	userID := uuid.New().String()
	teamID := uuid.New()
	seedUser(ctx, t, userID, role+"-authz@test.com")
	seedTeam(ctx, t, teamID, testTeamName)
	seedTeamMembership(ctx, t, teamID, userID, role)
	return userID, teamID
}

// --------------------------------------------------------------------------
// Rank / JSON tests
// --------------------------------------------------------------------------

func TestLowerRoles(t *testing.T) {
	{
		expected := []Rank{owner, admin, developer, viewer}
		result := owner.getLower()
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []Rank{admin, developer, viewer}
		result := admin.getLower()
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []Rank{developer, viewer}
		result := developer.getLower()
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []Rank{viewer}
		result := viewer.getLower()
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
}

func TestRank_ValidAndString(t *testing.T) {
	tests := []struct {
		name      string
		role      Rank
		wantValid bool
		wantStr   string
	}{
		{name: "owner", role: owner, wantValid: true, wantStr: "owner"},
		{name: "admin", role: admin, wantValid: true, wantStr: "admin"},
		{name: "developer", role: developer, wantValid: true, wantStr: "developer"},
		{name: "viewer", role: viewer, wantValid: true, wantStr: "viewer"},
		{name: "unknown", role: unknown, wantValid: false, wantStr: "unknown"},
		{name: "invalid", role: Rank(100), wantValid: false, wantStr: "unknown"},
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
		want    Rank
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
			var r Rank
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
				t.Fatalf("Rank = %v, want %v", r, tc.want)
			}
		})
	}
}

func TestRoleMap_CoversAllKnownRoles(t *testing.T) {
	tests := []struct {
		role string
		want Rank
	}{
		{role: "owner", want: owner},
		{role: "admin", want: admin},
		{role: "developer", want: developer},
		{role: "viewer", want: viewer},
		{role: "unknown", want: unknown},
	}

	for _, tt := range tests {
		t.Run(tt.role, func(t *testing.T) {
			if got := RoleMap[tt.role]; got != tt.want {
				t.Fatalf("RoleMap[%q] = %v, want %v", tt.role, got, tt.want)
			}
		})
	}
}

// --------------------------------------------------------------------------
// Scope map and role-derivation tests
// --------------------------------------------------------------------------

func TestSameOrLowerRoleFromScope(t *testing.T) {
	{
		expected := []Rank{owner, admin, developer, viewer}
		result := ScopeTeamInviteSameOrLower.GetRolesSameOrLower(owner)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []Rank{owner, admin, developer, viewer}
		result := ScopeTeamChangeRoleSameOrLower.GetRolesSameOrLower(owner)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []Rank{admin, developer, viewer}
		result := ScopeTeamInviteSameOrLower.GetRolesSameOrLower(admin)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []Rank{admin, developer, viewer}
		result := ScopeTeamChangeRoleSameOrLower.GetRolesSameOrLower(admin)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []Rank{developer, viewer}
		result := ScopeTeamInviteSameOrLower.GetRolesSameOrLower(developer)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []Rank{developer, viewer}
		result := ScopeTeamChangeRoleSameOrLower.GetRolesSameOrLower(developer)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []Rank{viewer}
		result := ScopeTeamInviteSameOrLower.GetRolesSameOrLower(viewer)
		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []Rank{}
		result := ScopeTeamChangeRoleSameOrLower.GetRolesSameOrLower(viewer)
		if len(expected) != len(result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
}

func TestScopeMap_AppScopes(t *testing.T) {
	tests := []struct {
		name           string
		role           Rank
		wantAppAll     bool
		wantAppRead    bool
		wantBillingAll bool
		wantTeamAll    bool
		wantBugAll     bool
		wantBugRead    bool
	}{
		{name: "owner", role: owner, wantAppAll: true, wantAppRead: false, wantBillingAll: true, wantTeamAll: true, wantBugAll: true, wantBugRead: false},
		{name: "admin", role: admin, wantAppAll: true, wantAppRead: false, wantBillingAll: true, wantTeamAll: false, wantBugAll: true, wantBugRead: false},
		{name: "developer", role: developer, wantAppAll: false, wantAppRead: true, wantBillingAll: false, wantTeamAll: false, wantBugAll: true, wantBugRead: false},
		{name: "viewer", role: viewer, wantAppAll: false, wantAppRead: true, wantBillingAll: false, wantTeamAll: false, wantBugAll: false, wantBugRead: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			roleScopes := ScopeMap[tt.role]
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
			if got := slices.Contains(roleScopes, *ScopeBugReportAll); got != tt.wantBugAll {
				t.Fatalf("ScopeBugReportAll = %v, want %v", got, tt.wantBugAll)
			}
			if got := slices.Contains(roleScopes, *ScopeBugReportRead); got != tt.wantBugRead {
				t.Fatalf("ScopeBugReportRead = %v, want %v", got, tt.wantBugRead)
			}
		})
	}
}

func TestScopeMap_TeamInviteAndAlertScopes(t *testing.T) {
	tests := []struct {
		name                    string
		role                    Rank
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
			roleScopes := ScopeMap[tt.role]
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
			if got := tc.scope.GetRolesSameOrLower(owner); len(got) != 0 {
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
		{name: "owner bug report all allowed", role: "owner", scope: *ScopeBugReportAll, wantAllow: true},
		{name: "admin bug report all allowed", role: "admin", scope: *ScopeBugReportAll, wantAllow: true},
		{name: "developer bug report all allowed", role: "developer", scope: *ScopeBugReportAll, wantAllow: true},
		{name: "viewer bug report all denied", role: "viewer", scope: *ScopeBugReportAll, wantAllow: false},
		{name: "viewer bug report read allowed", role: "viewer", scope: *ScopeBugReportRead, wantAllow: true},
		{name: "developer bug report read allowed", role: "developer", scope: *ScopeBugReportRead, wantAllow: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			defer cleanupAll(ctx, t)
			userID, teamID := seedTeamAndMemberWithRole(t, ctx, tc.role)

			allowed, err := PerformAuthz(deps.PgPool, userID, teamID.String(), tc.scope)
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

	t.Run("missing membership denies without error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, userID, "no-membership-authz@test.com")
		seedTeam(ctx, t, teamID, "team")

		allowed, err := PerformAuthz(deps.PgPool, userID, teamID.String(), *ScopeAppRead)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if allowed {
			t.Fatal("allowed = true, want false")
		}
	})

	t.Run("invalid user id returns query error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "team")

		allowed, err := PerformAuthz(deps.PgPool, "not-a-uuid", teamID.String(), *ScopeAppRead)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if allowed {
			t.Fatal("allowed = true, want false")
		}
	})
}
