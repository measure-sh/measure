//go:build integration

package measure

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

// A never-ingested app has NULL unique_identifier, first_version & onboarded_at.
// Populate must scan these into zero values instead of failing on NULL.
func TestPopulateNeverIngestedApp(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)

	appID := uuid.New()
	now := time.Now()
	_, err := th.PgPool.Exec(ctx, `
		insert into apps (id, team_id, app_name, os_names, onboarded, unique_identifier, first_version, onboarded_at, created_at, updated_at)
		values ($1, $2, $3, '{}', false, null, null, null, $4, $4)
	`, appID, teamID, "never-ingested", now)
	if err != nil {
		t.Fatalf("seed app: %v", err)
	}

	app := App{ID: &appID}
	if err := app.Populate(ctx, th.PgPool); err != nil {
		t.Fatalf("Populate: %v", err)
	}

	if app.UniqueId != "" {
		t.Errorf("UniqueId = %q, want empty", app.UniqueId)
	}
	if app.FirstVersion != "" {
		t.Errorf("FirstVersion = %q, want empty", app.FirstVersion)
	}
	if !app.OnboardedAt.IsZero() {
		t.Errorf("OnboardedAt = %v, want zero", app.OnboardedAt)
	}
}
