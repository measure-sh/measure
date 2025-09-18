package measure

import (
	"backend/api/filter"
	"backend/api/server"
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

type SessionTargetingRule struct {
	TeamId       uuid.UUID `json:"team_id" binding:"required"`
	AppId        uuid.UUID `json:"app_id" binding:"required"`
	Id           uuid.UUID `json:"id" binding:"required"`
	Name         string    `json:"name" binding:"required"`
	Status       int       `json:"status" binding:"required,oneof=0 1"`
	SamplingRate float64   `json:"sampling_rate" binding:"required,min=0,max=100"`
	Rule         string    `json:"rule" binding:"required"`
	CreatedAt    time.Time `json:"created_at" binding:"required"`
	CreatedBy    uuid.UUID `json:"created_by" binding:"required"`
	UpdatedAt    time.Time `json:"updated_at" binding:"required"`
	UpdatedBy    uuid.UUID `json:"updated_by" binding:"required"`
}

func GetSessionTargetingRulesWithFilter(ctx context.Context, af *filter.AppFilter) (rules []SessionTargetingRule, next, previous bool, err error) {
	stmt := sqlf.PostgreSQL.From("session_targeting_rules").
		Select("team_id").
		Select("app_id").
		Select("id").
		Select("name").
		Select("status").
		Select("sampling_rate").
		Select("rule").
		Select("created_at").
		Select("created_by").
		Select("updated_at").
		Select("updated_by").
		Where("app_id = ?", af.AppID)

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
		var rule SessionTargetingRule
		if err := rows.Scan(
			&rule.TeamId,
			&rule.AppId,
			&rule.Id,
			&rule.Name,
			&rule.Status,
			&rule.SamplingRate,
			&rule.Rule,
			&rule.CreatedAt,
			&rule.CreatedBy,
			&rule.UpdatedAt,
			&rule.UpdatedBy,
		); err != nil {
			return nil, false, false, err
		}
		rules = append(rules, rule)
	}

	resultLen := len(rules)

	// Set pagination next & previous flags
	if resultLen > af.Limit {
		rules = rules[:resultLen-1]
		next = true
	}
	if af.Offset > 0 {
		previous = true
	}

	return rules, next, previous, nil
}
