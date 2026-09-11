//go:build integration

package measure

import (
	"context"
	"testing"
	"time"

	"backend/libs/filter"

	"github.com/google/uuid"
)

func seedAlert(ctx context.Context, t *testing.T, teamID, appID uuid.UUID, message string, createdAt time.Time) {
	t.Helper()

	_, err := th.PgPool.Exec(ctx, `
		insert into alerts (id, team_id, app_id, entity_id, type, message, url, created_at, updated_at)
		values ($1, $2, $3, $4, 'new_crash', $5, 'https://example.com/alert', $6, $6)
	`, uuid.New(), teamID, appID, uuid.New().String(), message, createdAt)
	if err != nil {
		t.Fatalf("seed alert: %v", err)
	}
}

func TestGetAlertsWithFilter(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, testTeamName)
	seedApp(ctx, t, appID, teamID, 30)

	base := time.Date(2026, 1, 5, 10, 0, 0, 0, time.UTC)
	seedAlert(ctx, t, teamID, appID, "oldest", base.Add(-2*time.Hour))
	seedAlert(ctx, t, teamID, appID, "middle", base)
	seedAlert(ctx, t, teamID, appID, "newest", base.Add(time.Hour))

	newFilter := func(offset int) *filter.Filter {
		return &filter.Filter{
			AppID:  appID,
			TeamID: teamID,
			Entity: filter.AlertsEntity,
			From:   base.Add(-time.Hour),
			To:     base.Add(2 * time.Hour),
			Limit:  1,
			Offset: offset,
		}
	}

	alerts, next, previous, err := GetAlertsWithFilter(ctx, th.PgPool, newFilter(0))
	if err != nil {
		t.Fatalf("GetAlertsWithFilter: %v", err)
	}
	if len(alerts) != 1 || alerts[0].Message != "newest" {
		t.Fatalf("want the newest alert in range, got %v", alerts)
	}
	if !next || previous {
		t.Errorf("want next true and previous false, got next %v previous %v", next, previous)
	}

	alerts, _, previous, err = GetAlertsWithFilter(ctx, th.PgPool, newFilter(1))
	if err != nil {
		t.Fatalf("GetAlertsWithFilter: %v", err)
	}
	if len(alerts) != 1 || alerts[0].Message != "middle" {
		t.Fatalf("want the second alert in range, got %v", alerts)
	}
	if !previous {
		t.Error("want previous true past the first page")
	}
}
