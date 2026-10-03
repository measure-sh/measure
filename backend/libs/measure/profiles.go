package measure

import (
	"context"
	"encoding/json"
	"time"

	"backend/libs/chquery"
	"backend/libs/event"
	"backend/libs/filter"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// Profile is one captured profile in the profiles list.
type Profile struct {
	ID          uuid.UUID          `json:"id"`
	AppID       uuid.UUID          `json:"app_id"`
	SessionID   uuid.UUID          `json:"session_id"`
	Timestamp   time.Time          `json:"timestamp"`
	Trigger     string             `json:"trigger"`
	Format      string             `json:"format"`
	Attribute   *event.Attribute   `json:"attribute"`
	Attachments []event.Attachment `json:"attachments"`
}

// GetProfilesWithFilter reads the app's profiles matching the filter, newest
// first.
func (a App) GetProfilesWithFilter(ctx context.Context, rch driver.Conn, flt *filter.Filter) (profiles []Profile, next, previous bool, err error) {
	ctx = chquery.WithTeamScope(ctx, a.TeamId)

	stmt := sqlf.From("events").
		Select("id").
		Select("session_id").
		Select("timestamp").
		Select("`profile.trigger`").
		Select("`profile.format`").
		Select("`attribute.app_version`").
		Select("`attribute.app_build`").
		Select("`attribute.os_name`").
		Select("`attribute.os_version`").
		Select("`attribute.device_manufacturer`").
		Select("`attribute.device_model`").
		Select("attachments").
		Where("team_id = toUUID(?)", a.TeamId).
		Where("app_id = toUUID(?)", a.ID).
		Where("type = ?", event.TypeProfile).
		Where("timestamp >= ? AND timestamp <= ?", flt.From, flt.To).
		OrderBy("timestamp DESC").
		OrderBy("id DESC")
	defer stmt.Close()

	if err = applyProfilePredicate(stmt, flt); err != nil {
		return
	}
	if flt.Limit > 0 {
		stmt.Limit(uint64(flt.Limit) + 1)
	}
	if flt.Offset >= 0 {
		stmt.Offset(uint64(flt.Offset))
	}

	ctx, querySpan := tracer.Start(ctx, "profiles.list")
	defer querySpan.End()

	rows, err := rch.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		profile := Profile{
			AppID:     flt.AppID,
			Attribute: new(event.Attribute),
		}
		var attachments string
		if err = rows.Scan(
			&profile.ID,
			&profile.SessionID,
			&profile.Timestamp,
			&profile.Trigger,
			&profile.Format,
			&profile.Attribute.AppVersion,
			&profile.Attribute.AppBuild,
			&profile.Attribute.OSName,
			&profile.Attribute.OSVersion,
			&profile.Attribute.DeviceManufacturer,
			&profile.Attribute.DeviceModel,
			&attachments,
		); err != nil {
			return
		}
		if err = json.Unmarshal([]byte(attachments), &profile.Attachments); err != nil {
			return
		}
		profiles = append(profiles, profile)
	}
	if err = rows.Err(); err != nil {
		return
	}

	if flt.Limit > 0 && len(profiles) > flt.Limit {
		profiles = profiles[:len(profiles)-1]
		next = true
	}
	previous = flt.Offset > 0

	return
}

// applyProfilePredicate adds the filter expression to a profile events query.
func applyProfilePredicate(stmt *sqlf.Stmt, flt *filter.Filter) error {
	if !flt.HasFilterExpr() {
		return nil
	}

	predicate, err := flt.Predicate(nil)
	if err != nil {
		return err
	}
	defer predicate.Close()

	stmt.Where(predicate.String(), predicate.Args()...)
	return nil
}
