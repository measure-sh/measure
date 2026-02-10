package network

import (
	"backend/api/server"
	"context"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// FetchOrigins returns list of
// unique origins for a given
// app and team.
func FetchOrigins(ctx context.Context, appId, teamId uuid.UUID) (origins []string, err error) {
	stmt := sqlf.
		Select("distinct origin").
		From("http_metrics").
		Where("team_id = ?", teamId).
		Where("app_id = ?", appId).
		OrderBy("origin")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var origin string
		if err = rows.Scan(&origin); err != nil {
			return
		}
		if err = rows.Err(); err != nil {
			return
		}
		origins = append(origins, origin)
	}

	err = rows.Err()
	return
}
