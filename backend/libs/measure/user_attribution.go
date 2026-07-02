package measure

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/leporo/sqlf"
)

// SaveUserAttribution inserts a marketing-attribution row for a user. No-op
// when both identifiers are empty (the common case for users who didn't
// arrive via a Google Ad or who declined measurement consent).
//
// Empty identifiers become SQL NULL via nullableAttribution so we can
// distinguish "captured but blank" from "not captured at all".
func SaveUserAttribution(ctx context.Context, pg *pgxpool.Pool, userID, gaClientID, gclid string) error {
	if gaClientID == "" && gclid == "" {
		return nil
	}
	stmt := sqlf.PostgreSQL.
		InsertInto("user_attribution").
		Set("user_id", userID).
		Set("ga_client_id", nullableAttribution(gaClientID)).
		Set("gclid", nullableAttribution(gclid))
	defer stmt.Close()

	_, err := pg.Exec(ctx, stmt.String(), stmt.Args()...)
	return err
}

// nullableAttribution returns nil for empty strings so postgres stores NULL.
func nullableAttribution(s string) any {
	if s == "" {
		return nil
	}
	return s
}
