//go:build integration

package measure

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

// setUserAttribution inserts a row into measure.user_attribution for a user.
// Inserts both columns so a single helper covers all test cases; pass empty
// strings when the test wants the SQL NULL → empty-string COALESCE behavior.
func setUserAttribution(ctx context.Context, t *testing.T, userID, gaClientID, gclid string) {
	t.Helper()
	var ga, g any
	if gaClientID != "" {
		ga = gaClientID
	}
	if gclid != "" {
		g = gclid
	}
	_, err := th.PgPool.Exec(ctx,
		`INSERT INTO user_attribution (user_id, ga_client_id, gclid) VALUES ($1, $2, $3)`,
		userID, ga, g)
	if err != nil {
		t.Fatalf("insert user_attribution: %v", err)
	}
}

// seedMembershipAt inserts a team_membership row with an explicit created_at,
// so tests can control ordering for the "earliest owner wins" case.
func seedMembershipAt(ctx context.Context, t *testing.T, teamID, userID, role string, createdAt time.Time) {
	t.Helper()
	_, err := th.PgPool.Exec(ctx,
		`INSERT INTO team_membership (team_id, user_id, role, role_updated_at, created_at) VALUES ($1, $2, $3, $4, $5)`,
		teamID, userID, role, createdAt, createdAt)
	if err != nil {
		t.Fatalf("seed team_membership at: %v", err)
	}
}

func TestGetTeamOwner(t *testing.T) {
	ctx := context.Background()

	t.Run("single owner returns email + attribution", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		userID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, userID, "owner@example.com")
		setUserAttribution(ctx, t, userID, "client-123", "gclid-abc")
		seedTeamMembership(ctx, t, teamID, userID, "owner")

		owner, found, err := GetTeamOwner(ctx, teamID)
		if err != nil {
			t.Fatalf("GetTeamOwner: %v", err)
		}
		if !found {
			t.Fatal("found = false, want true")
		}
		if owner.UserID != userID {
			t.Errorf("UserID = %q, want %q", owner.UserID, userID)
		}
		if owner.Email != "owner@example.com" {
			t.Errorf("Email = %q, want owner@example.com", owner.Email)
		}
		if owner.GAClientID != "client-123" {
			t.Errorf("GAClientID = %q, want client-123", owner.GAClientID)
		}
		if owner.GCLID != "gclid-abc" {
			t.Errorf("GCLID = %q, want gclid-abc", owner.GCLID)
		}
	})

	t.Run("no owner row returns found=false, no error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		userID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, userID, "viewer@example.com")
		// role is 'viewer', not 'owner'
		seedTeamMembership(ctx, t, teamID, userID, "viewer")

		_, found, err := GetTeamOwner(ctx, teamID)
		if err != nil {
			t.Fatalf("GetTeamOwner err = %v, want nil", err)
		}
		if found {
			t.Error("found = true, want false")
		}
	})

	t.Run("team does not exist returns found=false, no error", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		_, found, err := GetTeamOwner(ctx, uuid.New())
		if err != nil {
			t.Fatalf("GetTeamOwner err = %v, want nil", err)
		}
		if found {
			t.Error("found = true, want false")
		}
	})

	t.Run("multiple owners returns earliest by created_at", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		earlierID := uuid.New().String()
		laterID := uuid.New().String()

		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, earlierID, "earlier@example.com")
		seedUser(ctx, t, laterID, "later@example.com")

		now := time.Now()
		seedMembershipAt(ctx, t, teamID.String(), earlierID, "owner", now.Add(-24*time.Hour))
		seedMembershipAt(ctx, t, teamID.String(), laterID, "owner", now)

		owner, found, err := GetTeamOwner(ctx, teamID)
		if err != nil {
			t.Fatalf("GetTeamOwner: %v", err)
		}
		if !found {
			t.Fatal("found = false")
		}
		if owner.Email != "earlier@example.com" {
			t.Errorf("Email = %q, want earlier@example.com (earliest owner)", owner.Email)
		}
	})

	t.Run("NULL attribution returns empty strings", func(t *testing.T) {
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		userID := uuid.New().String()
		seedTeam(ctx, t, teamID, testTeamName)
		seedUser(ctx, t, userID, "user@example.com")
		// no setUserAttribution call → both columns stay NULL
		seedTeamMembership(ctx, t, teamID, userID, "owner")

		owner, found, err := GetTeamOwner(ctx, teamID)
		if err != nil {
			t.Fatalf("GetTeamOwner: %v", err)
		}
		if !found {
			t.Fatal("found = false")
		}
		if owner.Email != "user@example.com" {
			t.Errorf("Email = %q", owner.Email)
		}
		if owner.GAClientID != "" {
			t.Errorf("GAClientID = %q, want \"\" for NULL", owner.GAClientID)
		}
		if owner.GCLID != "" {
			t.Errorf("GCLID = %q, want \"\" for NULL", owner.GCLID)
		}
	})
}
