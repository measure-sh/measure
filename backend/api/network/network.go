package network

import (
	"backend/api/server"
	"context"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// FetchOrigins returns distinct origins (protocol://host) from http_metrics for an app.
func FetchOrigins(ctx context.Context, appId, teamId uuid.UUID) (origins []string, err error) {
	stmt := sqlf.
		Select("distinct concat(protocol, '://', host) as origin").
		From("http_metrics").
		Where("app_id = ?", appId).
		Where("team_id = ?", teamId).
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
