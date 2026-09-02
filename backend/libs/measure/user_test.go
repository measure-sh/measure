//go:build integration

package measure

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// sqlInjectionEmail is a crafted invitee email that closes the quote & appends
// a UNION selecting every user, if the email is interpolated into the SQL.
const sqlInjectionEmail = `z') UNION SELECT id::text, email FROM users-- `

// confirmUser sets users.confirmed_at, which GetExistingAndNewInvitees
// requires for a user to count as existing.
func confirmUser(ctx context.Context, t *testing.T, userID string) {
	t.Helper()
	if _, err := th.PgPool.Exec(ctx, `UPDATE users SET confirmed_at = now() WHERE id = $1`, userID); err != nil {
		t.Fatalf("confirm user: %v", err)
	}
}

func TestGetExistingAndNewInviteesRejectsSQLInjection(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	realID := uuid.New().String()
	seedUser(ctx, t, realID, "real@test.com")
	confirmUser(ctx, t, realID)

	otherID := uuid.New().String()
	seedUser(ctx, t, otherID, "other@test.com")
	confirmUser(ctx, t, otherID)

	invitees := []Invitee{
		{Email: "real@test.com", Role: viewer},
		{Email: sqlInjectionEmail, Role: viewer},
	}

	existing, new, err := GetExistingAndNewInvitees(deps.PgPool, invitees)
	if err != nil {
		t.Fatalf("GetExistingAndNewInvitees: %v", err)
	}

	if len(existing) != 1 {
		t.Fatalf("existing = %d %v, want 1 (only real@test.com)", len(existing), existing)
	}
	if existing[0].Email != "real@test.com" {
		t.Errorf("existing[0].Email = %q, want real@test.com", existing[0].Email)
	}

	if len(new) != 1 {
		t.Fatalf("new = %d %v, want 1 (the injection string)", len(new), new)
	}
	if new[0].Email != sqlInjectionEmail {
		t.Errorf("new[0].Email = %q, want the injection string", new[0].Email)
	}
}
