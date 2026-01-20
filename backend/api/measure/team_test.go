//go:build integration

package measure

import (
	"context"
	"net/http"
	"testing"

	"backend/api/server"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// --------------------------------------------------------------------------
// Handler: GetAuthzRoles
// --------------------------------------------------------------------------

func TestGetAuthzRoles_BillingDisabled(t *testing.T) {
	for _, role := range []string{"owner", "admin", "developer", "viewer"} {
		role := role
		t.Run(role, func(t *testing.T) {
			ctx := context.Background()
			defer cleanupAll(ctx, t)

			orig := server.Server.Config.BillingEnabled
			server.Server.Config.BillingEnabled = false
			defer func() { server.Server.Config.BillingEnabled = orig }()

			userID := uuid.New().String()
			teamID := uuid.New()
			seedUser(ctx, t, userID, role+"@test.com")
			seedTeam(ctx, t, teamID, testTeamName, true)
			seedTeamMembership(ctx, t, teamID, userID, role)

			c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/authz", nil)
			c.Set("userId", userID)
			c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

			GetAuthzRoles(c)

			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
			}
			wantJSON(t, w, "can_change_billing", false)
		})
	}
}

func TestGetAuthzRoles_BillingEnabled(t *testing.T) {
	for _, tc := range []struct {
		role string
		want bool
	}{
		{"owner", true},
		{"admin", true},
		{"developer", false},
		{"viewer", false},
	} {
		tc := tc
		t.Run(tc.role, func(t *testing.T) {
			ctx := context.Background()
			defer cleanupAll(ctx, t)

			userID := uuid.New().String()
			teamID := uuid.New()
			seedUser(ctx, t, userID, tc.role+"@test.com")
			seedTeam(ctx, t, teamID, testTeamName, true)
			seedTeamMembership(ctx, t, teamID, userID, tc.role)

			c, w := newTestGinContext("GET", "/teams/"+teamID.String()+"/authz", nil)
			c.Set("userId", userID)
			c.Params = gin.Params{{Key: "id", Value: teamID.String()}}

			GetAuthzRoles(c)

			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
			}
			wantJSON(t, w, "can_change_billing", tc.want)
		})
	}
}
