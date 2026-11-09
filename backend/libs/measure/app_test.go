//go:build integration

package measure

import (
	"context"
	"testing"
	"time"

	"backend/libs/event"
	"backend/testinfra"

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

func TestSessionsWithReplay(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	otherAppID := uuid.New()
	seedTeam(ctx, t, teamID, "replay-team")
	seedApp(ctx, t, appID, teamID, 30)
	seedApp(ctx, t, otherAppID, teamID, 30)

	ts := time.Now().UTC().Add(-time.Minute)

	seed := func(appID, sessionID uuid.UUID, eventTypes ...string) {
		t.Helper()
		for _, eventType := range eventTypes {
			seedEventRows(ctx, t, teamID.String(), appID.String(), 1, testinfra.EventRow{
				Type:      eventType,
				SessionID: sessionID.String(),
				Timestamp: ts,
			})
		}
	}

	startOnly := uuid.New()
	seed(appID, startOnly, event.TypeSessionStart)

	startAndOneEvent := uuid.New()
	seed(appID, startAndOneEvent, event.TypeSessionStart, event.TypeGestureClick)

	startAndTwoEvents := uuid.New()
	seed(appID, startAndTwoEvents, event.TypeSessionStart, event.TypeGestureClick, event.TypeGestureClick)

	otherApp := uuid.New()
	seed(otherAppID, otherApp, event.TypeSessionStart, event.TypeGestureClick, event.TypeGestureClick)

	sessionIDs := []uuid.UUID{startOnly, startAndOneEvent, startAndTwoEvents, otherApp}
	a := App{ID: &appID, TeamId: teamID}

	tests := []struct {
		name      string
		ownEvents uint64
		want      map[uuid.UUID]bool
	}{
		{
			name:      "Item without its own event needs one event beyond session_start",
			ownEvents: 0,
			want:      map[uuid.UUID]bool{startAndOneEvent: true, startAndTwoEvents: true},
		},
		{
			name:      "Item with its own event needs one additional event beyond session_start",
			ownEvents: 1,
			want:      map[uuid.UUID]bool{startAndTwoEvents: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := a.sessionsWithReplay(ctx, deps.RchPool, sessionIDs, tt.ownEvents)
			if err != nil {
				t.Fatalf("sessionsWithReplay failed: %v", err)
			}
			if len(got) != len(tt.want) {
				t.Fatalf("Expected %v, got %v", tt.want, got)
			}
			for sessionID := range tt.want {
				if !got[sessionID] {
					t.Errorf("Expected session %s to have a replay, got %v", sessionID, got)
				}
			}
		})
	}

	t.Run("No session IDs returns no sessions", func(t *testing.T) {
		got, err := a.sessionsWithReplay(ctx, deps.RchPool, nil, 0)
		if err != nil {
			t.Fatalf("sessionsWithReplay failed: %v", err)
		}
		if len(got) != 0 {
			t.Errorf("Expected no sessions, got %v", got)
		}
	})
}
