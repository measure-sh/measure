//go:build integration

package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"backend/libs/autumn"
	autumntest "backend/libs/autumn/testhelpers"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// getMemberRole returns the member's role in a team, or "" when the
// membership row does not exist.
func getMemberRole(ctx context.Context, t *testing.T, teamID uuid.UUID, userID string) string {
	t.Helper()
	var role string
	err := th.PgPool.QueryRow(ctx,
		`SELECT role FROM team_membership WHERE team_id = $1 AND user_id = $2`, teamID, userID).Scan(&role)
	if err != nil {
		return ""
	}
	return role
}

func newRemoveMemberContext(callerID string, teamID uuid.UUID, memberID string) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := newTestGinContext("DELETE", fmt.Sprintf("/teams/%s/members/%s", teamID, memberID), nil)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: teamID.String()}, {Key: "memberId", Value: memberID}}
	return c, w
}

func newChangeRoleContext(callerID string, teamID uuid.UUID, memberID, role string) (*gin.Context, *httptest.ResponseRecorder) {
	body := bytes.NewBufferString(fmt.Sprintf(`{"role":%q}`, role))
	c, w := newTestGinContext("PATCH", fmt.Sprintf("/teams/%s/members/%s/role", teamID, memberID), body)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: teamID.String()}, {Key: "memberId", Value: memberID}}
	return c, w
}

func TestRemoveTeamMember(t *testing.T) {
	ctx := context.Background()

	t.Run("owner can remove a co-owner from the co-owner's default team", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		// the original signup owner and their auto-created team
		originalOwnerID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, originalOwnerID, "original-owner@test.com")
		seedTeam(ctx, t, teamID, testTeamName)
		seedTeamMembership(ctx, t, teamID, originalOwnerID, "owner")

		// a second owner added later
		newOwnerID := uuid.New().String()
		seedUser(ctx, t, newOwnerID, "new-owner@test.com")
		seedTeamMembership(ctx, t, teamID, newOwnerID, "owner")

		c, w := newRemoveMemberContext(newOwnerID, teamID, originalOwnerID)
		h.RemoveTeamMember(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if role := getMemberRole(ctx, t, teamID, originalOwnerID); role != "" {
			t.Errorf("membership still present with role %q, want removed", role)
		}

		// the removed user has no team left; the sign-in path re-provisions one
		removedUser := &measure.User{ID: &originalOwnerID}
		team, err := measure.EnsureDefaultTeam(ctx, th.PgPool, false, removedUser)
		if err != nil {
			t.Fatalf("EnsureDefaultTeam after removal: %v", err)
		}
		if team.ID == nil || *team.ID == teamID {
			t.Errorf("EnsureDefaultTeam returned team %v, want a newly created team", team.ID)
		}
		if role := getMemberRole(ctx, t, *team.ID, originalOwnerID); role != "owner" {
			t.Errorf("re-provisioned team role = %q, want owner", role)
		}
	})

	t.Run("removing the last owner is rejected", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		adminID := uuid.New().String()
		seedUser(ctx, t, adminID, "admin@test.com")
		seedTeamMembership(ctx, t, teamID, adminID, "admin")

		// owners rank equal, so the request passes the rank check and must
		// be stopped by the last-owner guard
		c, w := newRemoveMemberContext(ownerID, teamID, ownerID)
		h.RemoveTeamMember(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "error", "at least one owner")
		if role := getMemberRole(ctx, t, teamID, ownerID); role != "owner" {
			t.Errorf("owner membership = %q, want intact", role)
		}
	})

	t.Run("owner can remove a non-owner member", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		devID := uuid.New().String()
		seedUser(ctx, t, devID, "dev@test.com")
		seedTeamMembership(ctx, t, teamID, devID, "developer")

		c, w := newRemoveMemberContext(ownerID, teamID, devID)
		h.RemoveTeamMember(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if role := getMemberRole(ctx, t, teamID, devID); role != "" {
			t.Errorf("membership still present with role %q, want removed", role)
		}
	})

	t.Run("billing email moves to a remaining owner", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		originalOwnerID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, originalOwnerID, "original-owner@test.com")
		seedTeam(ctx, t, teamID, testTeamName)
		seedTeamMembership(ctx, t, teamID, originalOwnerID, "owner")

		newOwnerID := uuid.New().String()
		seedUser(ctx, t, newOwnerID, "new-owner@test.com")
		seedTeamMembership(ctx, t, teamID, newOwnerID, "owner")

		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{ID: custID, Email: "original-owner@test.com"}, nil
		})
		var updatedCustomerID, updatedEmail string
		autumntest.MockUpdateCustomer(t, func(_ context.Context, customerID, email string) error {
			updatedCustomerID = customerID
			updatedEmail = email
			return nil
		})

		c, w := newRemoveMemberContext(newOwnerID, teamID, originalOwnerID)
		h.RemoveTeamMember(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if updatedCustomerID != custID {
			t.Errorf("updated customer = %q, want %q", updatedCustomerID, custID)
		}
		if updatedEmail != "new-owner@test.com" {
			t.Errorf("updated email = %q, want new-owner@test.com", updatedEmail)
		}
	})

	t.Run("billing email set to another address is left alone", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		originalOwnerID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, originalOwnerID, "original-owner@test.com")
		seedTeam(ctx, t, teamID, testTeamName)
		seedTeamMembership(ctx, t, teamID, originalOwnerID, "owner")

		newOwnerID := uuid.New().String()
		seedUser(ctx, t, newOwnerID, "new-owner@test.com")
		seedTeamMembership(ctx, t, teamID, newOwnerID, "owner")

		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{ID: custID, Email: "finance@test.com"}, nil
		})
		updateCalled := false
		autumntest.MockUpdateCustomer(t, func(_ context.Context, _, _ string) error {
			updateCalled = true
			return nil
		})

		c, w := newRemoveMemberContext(newOwnerID, teamID, originalOwnerID)
		h.RemoveTeamMember(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if updateCalled {
			t.Error("UpdateCustomer called, want billing email left alone")
		}
	})
}

func TestChangeMemberRole(t *testing.T) {
	ctx := context.Background()

	t.Run("owner can demote a co-owner", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		originalOwnerID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, originalOwnerID, "original-owner@test.com")
		seedTeam(ctx, t, teamID, testTeamName)
		seedTeamMembership(ctx, t, teamID, originalOwnerID, "owner")

		newOwnerID := uuid.New().String()
		seedUser(ctx, t, newOwnerID, "new-owner@test.com")
		seedTeamMembership(ctx, t, teamID, newOwnerID, "owner")

		c, w := newChangeRoleContext(newOwnerID, teamID, originalOwnerID, "viewer")
		h.ChangeMemberRole(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if role := getMemberRole(ctx, t, teamID, originalOwnerID); role != "viewer" {
			t.Errorf("role = %q, want viewer", role)
		}
	})

	t.Run("demoting the last owner is rejected", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newChangeRoleContext(ownerID, teamID, ownerID, "admin")
		h.ChangeMemberRole(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "error", "at least one owner")
		if role := getMemberRole(ctx, t, teamID, ownerID); role != "owner" {
			t.Errorf("role = %q, want owner", role)
		}
	})

	t.Run("missing role field gets 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		devID := uuid.New().String()
		seedUser(ctx, t, devID, "dev@test.com")
		seedTeamMembership(ctx, t, teamID, devID, "developer")

		body := bytes.NewBufferString(`{}`)
		c, w := newTestGinContext("PATCH", fmt.Sprintf("/teams/%s/members/%s/role", teamID, devID), body)
		c.Set("userId", ownerID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}, {Key: "memberId", Value: devID}}
		h.ChangeMemberRole(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
		if role := getMemberRole(ctx, t, teamID, devID); role != "developer" {
			t.Errorf("role = %q, want developer (unchanged)", role)
		}
	})

	t.Run("admin cannot assign the owner role", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		_, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		adminID := uuid.New().String()
		seedUser(ctx, t, adminID, "admin@test.com")
		seedTeamMembership(ctx, t, teamID, adminID, "admin")
		devID := uuid.New().String()
		seedUser(ctx, t, devID, "dev@test.com")
		seedTeamMembership(ctx, t, teamID, devID, "developer")

		c, w := newChangeRoleContext(adminID, teamID, devID, "owner")
		h.ChangeMemberRole(c)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403, body: %s", w.Code, w.Body.String())
		}
		if role := getMemberRole(ctx, t, teamID, devID); role != "developer" {
			t.Errorf("role = %q, want developer", role)
		}
	})

	t.Run("billing email moves to a remaining owner on demotion", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		originalOwnerID := uuid.New().String()
		teamID := uuid.New()
		seedUser(ctx, t, originalOwnerID, "original-owner@test.com")
		seedTeam(ctx, t, teamID, testTeamName)
		seedTeamMembership(ctx, t, teamID, originalOwnerID, "owner")

		newOwnerID := uuid.New().String()
		seedUser(ctx, t, newOwnerID, "new-owner@test.com")
		seedTeamMembership(ctx, t, teamID, newOwnerID, "owner")

		custID := uuid.New().String()
		seedTeamAutumnCustomer(ctx, t, teamID, custID)

		autumntest.MockGetCustomer(t, func(_ context.Context, _ string) (*autumn.Customer, error) {
			return &autumn.Customer{ID: custID, Email: "original-owner@test.com"}, nil
		})
		var updatedEmail string
		autumntest.MockUpdateCustomer(t, func(_ context.Context, _, email string) error {
			updatedEmail = email
			return nil
		})

		c, w := newChangeRoleContext(newOwnerID, teamID, originalOwnerID, "viewer")
		h.ChangeMemberRole(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if updatedEmail != "new-owner@test.com" {
			t.Errorf("updated email = %q, want new-owner@test.com", updatedEmail)
		}
	})
}

func TestCreateTeam(t *testing.T) {
	ctx := context.Background()

	t.Run("user with no team can create one", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "creator@test.com")

		c, w := newTestGinContext("POST", "/teams", bytes.NewBufferString(`{"name":"fresh-team"}`))
		c.Set("userId", userID)
		h.CreateTeam(c)

		if w.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201, body: %s", w.Code, w.Body.String())
		}
		var created measure.Team
		if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if created.ID == nil {
			t.Fatal("response team has no id")
		}
		if role := getMemberRole(ctx, t, *created.ID, userID); role != "owner" {
			t.Errorf("creator role = %q, want owner", role)
		}
		if id := getTeamAutumnCustomerID(ctx, t, *created.ID); id == nil || *id == "" {
			t.Error("autumn customer not provisioned for new team")
		}
	})

	t.Run("empty name is rejected", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "creator@test.com")

		c, w := newTestGinContext("POST", "/teams", bytes.NewBufferString(`{"name":"  "}`))
		c.Set("userId", userID)
		h.CreateTeam(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("missing name is rejected", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "creator@test.com")

		c, w := newTestGinContext("POST", "/teams", bytes.NewBufferString(`{}`))
		c.Set("userId", userID)
		h.CreateTeam(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})
}

// --------------------------------------------------------------------------
// Helpers for invite and team assertions
// --------------------------------------------------------------------------

// seedInviteRow inserts an invites row with an explicit updated_at so tests
// can control invite validity (valid = updated_at within TeamInviteValidity).
func seedInviteRow(ctx context.Context, t *testing.T, inviteID, teamID uuid.UUID, byUserID, role, email string, updatedAt time.Time) {
	t.Helper()
	_, err := th.PgPool.Exec(ctx,
		`INSERT INTO invites (id, invited_by_user_id, invited_to_team_id, invited_as_role, email, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $6)`,
		inviteID, byUserID, teamID, role, email, updatedAt)
	if err != nil {
		t.Fatalf("seed invite: %v", err)
	}
}

// confirmUser sets users.confirmed_at, which GetExistingAndNewInvitees
// requires before treating an email as an existing user.
func confirmUser(ctx context.Context, t *testing.T, userID string) {
	t.Helper()
	if _, err := th.PgPool.Exec(ctx, `UPDATE users SET confirmed_at = now() WHERE id = $1`, userID); err != nil {
		t.Fatalf("confirm user: %v", err)
	}
}

func countInvitesForTeam(ctx context.Context, t *testing.T, teamID uuid.UUID) int {
	t.Helper()
	var count int
	if err := th.PgPool.QueryRow(ctx,
		`SELECT count(*) FROM invites WHERE invited_to_team_id = $1`, teamID).Scan(&count); err != nil {
		t.Fatalf("count invites: %v", err)
	}
	return count
}

func inviteUpdatedAt(ctx context.Context, t *testing.T, inviteID uuid.UUID) time.Time {
	t.Helper()
	var updatedAt time.Time
	if err := th.PgPool.QueryRow(ctx,
		`SELECT updated_at FROM invites WHERE id = $1`, inviteID).Scan(&updatedAt); err != nil {
		t.Fatalf("get invite updated_at: %v", err)
	}
	return updatedAt
}

func teamNameInDB(ctx context.Context, t *testing.T, teamID uuid.UUID) string {
	t.Helper()
	var name string
	if err := th.PgPool.QueryRow(ctx,
		`SELECT name FROM teams WHERE id = $1`, teamID).Scan(&name); err != nil {
		t.Fatalf("read team name: %v", err)
	}
	return name
}

func decodeJSONArray(t *testing.T, w *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	var items []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatalf("unmarshal response array: %v, body: %s", err, w.Body.String())
	}
	return items
}

// --------------------------------------------------------------------------
// GetTeams
// --------------------------------------------------------------------------

func TestGetTeams(t *testing.T) {
	ctx := context.Background()

	t.Run("returns the caller's teams with roles", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		otherTeamID := uuid.New()
		seedTeam(ctx, t, otherTeamID, "second-team")
		seedTeamMembership(ctx, t, otherTeamID, userID, "viewer")

		c, w := newTestGinContext("GET", "/teams", nil)
		c.Set("userId", userID)
		h.GetTeams(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		teams := decodeJSONArray(t, w)
		if len(teams) != 2 {
			t.Fatalf("len(teams) = %d, want 2", len(teams))
		}
		roleByID := map[string]string{}
		for _, tm := range teams {
			roleByID[tm["id"].(string)] = tm["role"].(string)
		}
		if roleByID[teamID.String()] != "owner" || roleByID[otherTeamID.String()] != "viewer" {
			t.Errorf("teams = %v, want owner + viewer roles", roleByID)
		}
	})

	t.Run("user with no teams gets 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID := uuid.New().String()
		seedUser(ctx, t, userID, "orphan@test.com")

		c, w := newTestGinContext("GET", "/teams", nil)
		c.Set("userId", userID)
		h.GetTeams(c)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404, body: %s", w.Code, w.Body.String())
		}
	})
}

// --------------------------------------------------------------------------
// GetTeamApps / GetTeamApp
// --------------------------------------------------------------------------

func TestGetTeamApps(t *testing.T) {
	ctx := context.Background()

	t.Run("member can list the team's apps", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)
		seedAPIKey(ctx, t, appID, "msrsh", "key-value", "checksum", false, nil, time.Now())

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/apps", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		h.GetTeamApps(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		apps := decodeJSONArray(t, w)
		if len(apps) != 1 {
			t.Fatalf("len(apps) = %d, want 1", len(apps))
		}
		if apps[0]["id"] != appID.String() {
			t.Errorf("app id = %v, want %s", apps[0]["id"], appID)
		}
	})

	t.Run("team without apps gets 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/apps", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		h.GetTeamApps(c)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("non-member gets an error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		_, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		outsiderID := uuid.New().String()
		seedUser(ctx, t, outsiderID, "outsider@test.com")

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/apps", nil)
		c.Set("userId", outsiderID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		h.GetTeamApps(c)

		// PerformAuthz errors on an unknown role, so a non-member gets 500
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500 for unknown role, body: %s", w.Code, w.Body.String())
		}
	})
}

func TestGetTeamApp(t *testing.T) {
	ctx := context.Background()

	t.Run("member can fetch a team app", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)
		seedAPIKey(ctx, t, appID, "msrsh", "key-value", "checksum", false, nil, time.Now())

		c, w := newTestGinContext("GET", fmt.Sprintf("/teams/%s/apps/%s", teamID, appID), nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}, {Key: "appId", Value: appID.String()}}
		h.GetTeamApp(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("app of another team gets 404", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")
		otherTeamID := uuid.New()
		seedTeam(ctx, t, otherTeamID, "other-team")
		foreignAppID := uuid.New()
		seedApp(ctx, t, foreignAppID, otherTeamID, 90)
		seedAPIKey(ctx, t, foreignAppID, "msrsh", "key-value", "checksum", false, nil, time.Now())

		c, w := newTestGinContext("GET", fmt.Sprintf("/teams/%s/apps/%s", teamID, foreignAppID), nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}, {Key: "appId", Value: foreignAppID.String()}}
		h.GetTeamApp(c)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("non-member gets an error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		_, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		appID := uuid.New()
		seedApp(ctx, t, appID, teamID, 90)
		outsiderID := uuid.New().String()
		seedUser(ctx, t, outsiderID, "outsider@test.com")

		c, w := newTestGinContext("GET", fmt.Sprintf("/teams/%s/apps/%s", teamID, appID), nil)
		c.Set("userId", outsiderID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}, {Key: "appId", Value: appID.String()}}
		h.GetTeamApp(c)

		// PerformAuthz errors on an unknown role, so a non-member gets 500
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500 for unknown role, body: %s", w.Code, w.Body.String())
		}
	})
}

// --------------------------------------------------------------------------
// InviteMembers
// --------------------------------------------------------------------------

func newInviteContext(callerID string, teamID uuid.UUID, body string) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := newTestGinContext("POST", "/teams/"+teamID.String()+"/invite", bytes.NewBufferString(body))
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
	return c, w
}

func TestInviteMembers(t *testing.T) {
	ctx := context.Background()

	t.Run("new email gets an invite row", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newInviteContext(ownerID, teamID, `[{"email":"new@test.com","role":"admin"}]`)
		h.InviteMembers(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "ok", "Invited new@test.com")
		if n := countInvitesForTeam(ctx, t, teamID); n != 1 {
			t.Errorf("invites = %d, want 1", n)
		}
	})

	t.Run("existing confirmed user is added as member directly", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		existingID := uuid.New().String()
		seedUser(ctx, t, existingID, "existing@test.com")
		confirmUser(ctx, t, existingID)

		c, w := newInviteContext(ownerID, teamID, `[{"email":"existing@test.com","role":"developer"}]`)
		h.InviteMembers(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		wantJSONContains(t, w, "ok", "Added existing@test.com")
		if role := getMemberRole(ctx, t, teamID, existingID); role != "developer" {
			t.Errorf("role = %q, want developer", role)
		}
		if n := countInvitesForTeam(ctx, t, teamID); n != 0 {
			t.Errorf("invites = %d, want 0 (added directly, not invited)", n)
		}
	})

	t.Run("viewer cannot invite above their rank", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		viewerID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")

		c, w := newInviteContext(viewerID, teamID, `[{"email":"new@test.com","role":"admin"}]`)
		h.InviteMembers(c)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("admin cannot invite an owner", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		adminID, teamID := seedTeamAndMemberWithRole(t, ctx, "admin")

		c, w := newInviteContext(adminID, teamID, `[{"email":"new@test.com","role":"owner"}]`)
		h.InviteMembers(c)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("inviting an existing member gets 409", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		memberID := uuid.New().String()
		seedUser(ctx, t, memberID, "member@test.com")
		seedTeamMembership(ctx, t, teamID, memberID, "viewer")

		c, w := newInviteContext(ownerID, teamID, `[{"email":"member@test.com","role":"viewer"}]`)
		h.InviteMembers(c)

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("empty invitee list gets 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newInviteContext(ownerID, teamID, `[]`)
		h.InviteMembers(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("more than the invitee cap gets 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		invitees := make([]string, 0, 26)
		for i := range 26 {
			invitees = append(invitees, fmt.Sprintf(`{"email":"user%d@test.com","role":"viewer"}`, i))
		}
		body := "[" + strings.Join(invitees, ",") + "]"

		c, w := newInviteContext(ownerID, teamID, body)
		h.InviteMembers(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})
}

// --------------------------------------------------------------------------
// GetValidTeamInvites
// --------------------------------------------------------------------------

func TestGetValidTeamInvites(t *testing.T) {
	ctx := context.Background()

	t.Run("member sees valid invites only", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		userID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")
		seedInviteRow(ctx, t, uuid.New(), teamID, userID, "admin", "fresh@test.com", time.Now())
		seedInviteRow(ctx, t, uuid.New(), teamID, userID, "viewer", "stale@test.com", time.Now().Add(-8*24*time.Hour))

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/invites", nil)
		c.Set("userId", userID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		h.GetValidTeamInvites(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		invites := decodeJSONArray(t, w)
		if len(invites) != 1 {
			t.Fatalf("len(invites) = %d, want 1", len(invites))
		}
		if invites[0]["email"] != "fresh@test.com" {
			t.Errorf("invite email = %v, want fresh@test.com", invites[0]["email"])
		}
	})

	t.Run("non-member gets an error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		_, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		outsiderID := uuid.New().String()
		seedUser(ctx, t, outsiderID, "outsider@test.com")

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/invites", nil)
		c.Set("userId", outsiderID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		h.GetValidTeamInvites(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500 for unknown role, body: %s", w.Code, w.Body.String())
		}
	})
}

// --------------------------------------------------------------------------
// ResendInvite / RemoveInvite
// --------------------------------------------------------------------------

func newInviteActionContext(method string, callerID string, teamID, inviteID uuid.UUID) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := newTestGinContext(method, fmt.Sprintf("/teams/%s/invites/%s", teamID, inviteID), nil)
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: teamID.String()}, {Key: "inviteId", Value: inviteID.String()}}
	return c, w
}

func TestResendInvite(t *testing.T) {
	ctx := context.Background()

	t.Run("owner can resend and validity restarts", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		inviteID := uuid.New()
		seedInviteRow(ctx, t, inviteID, teamID, ownerID, "viewer", "dev@test.com", time.Now().Add(-8*24*time.Hour))

		before := inviteUpdatedAt(ctx, t, inviteID)

		c, w := newInviteActionContext("PATCH", ownerID, teamID, inviteID)
		h.ResendInvite(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if after := inviteUpdatedAt(ctx, t, inviteID); !after.After(before) {
			t.Errorf("updated_at not bumped: before %v, after %v", before, after)
		}
	})

	t.Run("admin cannot resend an owner invite", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		adminID := uuid.New().String()
		seedUser(ctx, t, adminID, "admin@test.com")
		seedTeamMembership(ctx, t, teamID, adminID, "admin")

		inviteID := uuid.New()
		seedInviteRow(ctx, t, inviteID, teamID, ownerID, "owner", "future-owner@test.com", time.Now())

		c, w := newInviteActionContext("PATCH", adminID, teamID, inviteID)
		h.ResendInvite(c)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("unknown invite gets an error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newInviteActionContext("PATCH", ownerID, teamID, uuid.New())
		h.ResendInvite(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500 for missing invite, body: %s", w.Code, w.Body.String())
		}
	})
}

func TestRemoveInvite(t *testing.T) {
	ctx := context.Background()

	t.Run("owner can remove an invite", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		inviteID := uuid.New()
		seedInviteRow(ctx, t, inviteID, teamID, ownerID, "viewer", "dev@test.com", time.Now())

		c, w := newInviteActionContext("DELETE", ownerID, teamID, inviteID)
		h.RemoveInvite(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if n := countInvitesForTeam(ctx, t, teamID); n != 0 {
			t.Errorf("invites = %d, want 0", n)
		}
	})

	t.Run("admin cannot remove an owner invite", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		adminID := uuid.New().String()
		seedUser(ctx, t, adminID, "admin@test.com")
		seedTeamMembership(ctx, t, teamID, adminID, "admin")

		inviteID := uuid.New()
		seedInviteRow(ctx, t, inviteID, teamID, ownerID, "owner", "future-owner@test.com", time.Now())

		c, w := newInviteActionContext("DELETE", adminID, teamID, inviteID)
		h.RemoveInvite(c)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403, body: %s", w.Code, w.Body.String())
		}
		if n := countInvitesForTeam(ctx, t, teamID); n != 1 {
			t.Errorf("invites = %d, want 1 (invite kept)", n)
		}
	})
}

// --------------------------------------------------------------------------
// RenameTeam
// --------------------------------------------------------------------------

func newRenameContext(callerID string, teamID uuid.UUID, body string) (*gin.Context, *httptest.ResponseRecorder) {
	c, w := newTestGinContext("PATCH", "/teams/"+teamID.String()+"/rename", bytes.NewBufferString(body))
	c.Set("userId", callerID)
	c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
	return c, w
}

func TestRenameTeam(t *testing.T) {
	ctx := context.Background()

	t.Run("owner can rename the team", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newRenameContext(ownerID, teamID, `{"name":"  renamed-team  "}`)
		h.RenameTeam(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if got := teamNameInDB(ctx, t, teamID); got != "renamed-team" {
			t.Errorf("name = %q, want renamed-team (trimmed)", got)
		}
	})

	t.Run("admin cannot rename", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		adminID, teamID := seedTeamAndMemberWithRole(t, ctx, "admin")

		c, w := newRenameContext(adminID, teamID, `{"name":"renamed-team"}`)
		h.RenameTeam(c)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403, body: %s", w.Code, w.Body.String())
		}
		if got := teamNameInDB(ctx, t, teamID); got != testTeamName {
			t.Errorf("name = %q, want unchanged %q", got, testTeamName)
		}
	})

	t.Run("missing name gets 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newRenameContext(ownerID, teamID, `{}`)
		h.RenameTeam(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("blank name gets 400", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		c, w := newRenameContext(ownerID, teamID, `{"name":"   "}`)
		h.RenameTeam(c)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("a body-supplied id cannot redirect the rename", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		ownerID, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")

		// a team the caller has nothing to do with
		victimID := uuid.New()
		seedTeam(ctx, t, victimID, "victim-team")

		body := fmt.Sprintf(`{"id":%q,"name":"hacked"}`, victimID)
		c, w := newRenameContext(ownerID, teamID, body)
		h.RenameTeam(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		if got := teamNameInDB(ctx, t, teamID); got != "hacked" {
			t.Errorf("url team name = %q, want hacked (url id wins)", got)
		}
		if got := teamNameInDB(ctx, t, victimID); got != "victim-team" {
			t.Errorf("victim team name = %q, want unchanged", got)
		}
	})
}

// --------------------------------------------------------------------------
// GetTeamMembers
// --------------------------------------------------------------------------

func TestGetTeamMembers(t *testing.T) {
	ctx := context.Background()

	t.Run("member can list members with roles", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		viewerID, teamID := seedTeamAndMemberWithRole(t, ctx, "viewer")
		ownerID := uuid.New().String()
		seedUser(ctx, t, ownerID, "owner@test.com")
		seedTeamMembership(ctx, t, teamID, ownerID, "owner")

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/members", nil)
		c.Set("userId", viewerID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		h.GetTeamMembers(c)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200, body: %s", w.Code, w.Body.String())
		}
		members := decodeJSONArray(t, w)
		if len(members) != 2 {
			t.Fatalf("len(members) = %d, want 2", len(members))
		}
	})

	t.Run("non-member gets an error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		_, teamID := seedTeamAndMemberWithRole(t, ctx, "owner")
		outsiderID := uuid.New().String()
		seedUser(ctx, t, outsiderID, "outsider@test.com")

		c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/members", nil)
		c.Set("userId", outsiderID)
		c.Params = gin.Params{{Key: "id", Value: teamID.String()}}
		h.GetTeamMembers(c)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want 500 for unknown role, body: %s", w.Code, w.Body.String())
		}
	})
}
