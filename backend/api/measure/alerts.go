package measure

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"

	"backend/api/filter"
	"backend/api/server"
)

type Alert struct {
	ID        uuid.UUID `db:"id" json:"id"`
	TeamID    uuid.UUID `db:"team_id" json:"team_id"`
	AppID     uuid.UUID `db:"app_id" json:"app_id"`
	EntityID  string    `db:"entity_id" json:"entity_id"`
	Type      string    `db:"type" json:"type"`
	Message   string    `db:"message" json:"message"`
	Url       string    `db:"url" json:"url"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

func GetAlertsWithFilter(ctx context.Context, af *filter.AppFilter) (alerts []Alert, next, previous bool, err error) {
	stmt := sqlf.PostgreSQL.From("public.alerts").
		Select("id").
		Select("team_id").
		Select("app_id").
		Select("entity_id").
		Select("type").
		Select("message").
		Select("url").
		Select("created_at").
		Select("updated_at").
		Where("app_id = ?", af.AppID).
		Where("created_at >= ?", af.From).
		Where("created_at <= ?", af.To)

	if af.Limit > 0 {
		stmt.Limit(uint64(af.Limit) + 1)
	}

	if af.Offset >= 0 {
		stmt.Offset(uint64(af.Offset))
	}

	stmt.OrderBy("created_at DESC")

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, false, false, err
	}
	defer rows.Close()

	for rows.Next() {
		var alert Alert
		if err := rows.Scan(
			&alert.ID,
			&alert.TeamID,
			&alert.AppID,
			&alert.EntityID,
			&alert.Type,
			&alert.Message,
			&alert.Url,
			&alert.CreatedAt,
			&alert.UpdatedAt,
		); err != nil {
			return nil, false, false, err
		}
		alerts = append(alerts, alert)
	}

	resultLen := len(alerts)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		alerts = alerts[:resultLen-1]
		next = true
	}
	if af.Offset > 0 {
		previous = true
	}

	return alerts, next, previous, nil
}
