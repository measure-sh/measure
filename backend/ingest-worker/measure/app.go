package measure

import (
	"backend/ingest-worker/server"
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/leporo/sqlf"
)

type App struct {
	ID           *uuid.UUID `json:"id"`
	TeamId       uuid.UUID  `json:"team_id"`
	OSNames      []string   `json:"os_names"`
	FirstVersion string     `json:"first_version"`
	Onboarded    bool       `json:"onboarded"`
	OnboardedAt  time.Time  `json:"onboarded_at"`
}

// SelectApp selects app by its id.
func SelectApp(ctx context.Context, id uuid.UUID) (app *App, err error) {
	var onboarded pgtype.Bool
	var firstVersion pgtype.Text

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("team_id").
		Select("onboarded").
		Select("os_names").
		Select("first_version").
		From("apps").
		Where("id = ?", id)

	defer stmt.Close()

	if app == nil {
		app = &App{}
	}

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&app.ID, &app.TeamId, &onboarded, &app.OSNames, &firstVersion); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	if onboarded.Valid {
		app.Onboarded = onboarded.Bool
	} else {
		app.Onboarded = false
	}

	if firstVersion.Valid {
		app.FirstVersion = firstVersion.String
	} else {
		app.FirstVersion = ""
	}

	return
}

func (a *App) Onboard(ctx context.Context, tx *pgx.Tx, uniqueIdentifier, firstVersion string) error {
	now := time.Now()
	stmt := sqlf.PostgreSQL.Update("apps").
		Set("onboarded", true).
		Set("unique_identifier", uniqueIdentifier).
		Set("first_version", firstVersion).
		Set("onboarded_at", now).
		Set("updated_at", now).
		Where("id = ?", a.ID)

	defer stmt.Close()

	_, err := (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

// AddOSName appends osName to the app's os_names array if it is not already
// present. The conditional WHERE keeps concurrent appends from parallel batch
// workers race-safe: the row lock serializes them and the predicate prevents
// duplicate entries.
func (a *App) AddOSName(ctx context.Context, osName string) error {
	now := time.Now()
	stmt := sqlf.PostgreSQL.Update("apps").
		SetExpr("os_names", "array_append(os_names, ?)", osName).
		Set("updated_at", now).
		Where("id = ?", a.ID).
		Where("NOT (? = ANY(os_names))", osName)

	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}
