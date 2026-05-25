package measure

import (
	"context"
	"errors"
	"log"
	"time"

	"backend/ingest-worker/server"
	"backend/libs/ga4"
	"backend/libs/posthog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/leporo/sqlf"
)

// TeamOwner holds the contact, identity and GA tracking identifiers of the
// owning user of a team.
type TeamOwner struct {
	UserID     string
	Email      string
	GAClientID string
	GCLID      string
	CreatedAt  time.Time
}

// GetTeamOwner returns the team's owning user's id, email, ga_client_id, gclid
// and signup timestamp. When the team has multiple owner-role members, the
// earliest-joined owner is returned. The found bool is false when no
// owner-role member exists.
func GetTeamOwner(ctx context.Context, teamID uuid.UUID) (owner TeamOwner, found bool, err error) {
	stmt := sqlf.PostgreSQL.
		Select("u.id").
		Select("u.email").
		Select("ua.ga_client_id").
		Select("ua.gclid").
		Select("u.created_at").
		From("users u").
		Join("team_membership tm", "tm.user_id = u.id").
		LeftJoin("user_attribution ua", "ua.user_id = u.id").
		Where("tm.team_id = ?", teamID).
		Where("tm.role = ?", "owner").
		OrderBy("tm.created_at ASC").
		Limit(1)

	defer stmt.Close()

	var userID uuid.UUID
	var email pgtype.Text
	var gaClientID pgtype.Text
	var gclid pgtype.Text
	var createdAt pgtype.Timestamptz

	if err = server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&userID, &email, &gaClientID, &gclid, &createdAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TeamOwner{}, false, nil
		}
		return TeamOwner{}, false, err
	}

	owner.UserID = userID.String()
	if email.Valid {
		owner.Email = email.String
	}
	if gaClientID.Valid {
		owner.GAClientID = gaClientID.String
	}
	if gclid.Valid {
		owner.GCLID = gclid.String
	}
	if createdAt.Valid {
		owner.CreatedAt = createdAt.Time
	}

	return owner, true, nil
}

// fireFirstIngestionEvents fires the `first_event_ingested` event to both
// GA4 and PostHog the first time an app's events land. Called from the
// onboarding path in event.go after the app.Onboard transaction commits.
// Best-effort: every failure is logged and swallowed.
func fireFirstIngestionEvents(ctx context.Context, appID, teamID uuid.UUID, osName string) {
	owner, found, err := GetTeamOwner(ctx, teamID)
	if err != nil {
		log.Printf("analytics: lookup team owner for app %s failed: %v", appID, err)
		return
	}
	if !found {
		log.Printf("analytics: no owner found for team %s (app %s), skipping first-ingestion events", teamID, appID)
		return
	}

	ga4.Send(ctx, owner.GAClientID, owner.Email, "first_event_ingested", map[string]any{
		"value":    50,
		"currency": "USD",
	})

	var timeSinceSignupMinutes float64
	if !owner.CreatedAt.IsZero() {
		timeSinceSignupMinutes = time.Since(owner.CreatedAt).Minutes()
	}
	posthog.Capture(owner.UserID, "first_event_ingested", map[string]any{
		"schema_version":            "v1",
		"team_id":                   teamID.String(),
		"app_id":                    appID.String(),
		"app_platform":              osName,
		"time_since_signup_minutes": timeSinceSignupMinutes,
	}, map[string]string{"team": teamID.String()})
}
