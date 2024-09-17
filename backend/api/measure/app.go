package measure

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"backend/api/event"
	"backend/api/filter"
	"backend/api/group"
	"backend/api/journey"
	"backend/api/metrics"
	"backend/api/paginate"
	"backend/api/replay"
	"backend/api/server"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/leporo/sqlf"
)

type App struct {
	ID           *uuid.UUID `json:"id"`
	TeamId       uuid.UUID  `json:"team_id"`
	AppName      string     `json:"name" binding:"required"`
	UniqueId     string     `json:"unique_identifier"`
	Platform     string     `json:"platform"`
	APIKey       *APIKey    `json:"api_key"`
	FirstVersion string     `json:"first_version"`
	Onboarded    bool       `json:"onboarded"`
	OnboardedAt  time.Time  `json:"onboarded_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func (a App) MarshalJSON() ([]byte, error) {
	type Alias App
	return json.Marshal(&struct {
		*Alias
		Platform    *string    `json:"platform"`
		OnboardedAt *time.Time `json:"onboarded_at"`
		UniqueId    *string    `json:"unique_identifier"`
	}{
		Platform: func() *string {
			if a.Platform == "" {
				return nil
			}
			return &a.Platform
		}(),
		UniqueId: func() *string {
			if a.UniqueId == "" {
				return nil
			}
			return &a.UniqueId
		}(),
		OnboardedAt: func() *time.Time {
			if a.OnboardedAt.IsZero() {
				return nil
			}
			return &a.OnboardedAt
		}(),
		Alias: (*Alias)(&a),
	})
}

// GetExceptionGroup queries a single exception group by its id.
func (a App) GetExceptionGroup(ctx context.Context, id uuid.UUID) (exceptionGroup *group.ExceptionGroup, err error) {
	stmt := sqlf.PostgreSQL.
		From("public.unhandled_exception_groups").
		Select("id").
		Select("app_id").
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select("fingerprint").
		Select("first_event_timestamp").
		Select("created_at").
		Select("updated_at").
		Where("app_id = ?", a.ID).
		Where("id = ?", id)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if rows.Err() != nil {
		return
	}

	row, err := pgx.CollectOneRow(rows, pgx.RowToStructByNameLax[group.ExceptionGroup])
	if errors.Is(err, pgx.ErrNoRows) {
		err = nil
		return
	} else if err != nil {
		return
	}

	exceptionGroup = &row

	// Get list of event IDs
	eventDataStmt := sqlf.From(`default.events`).
		Select(`id`).
		Where(`exception.fingerprint = (?)`, exceptionGroup.Fingerprint)

	eventDataRows, err := server.Server.ChPool.Query(ctx, eventDataStmt.String(), eventDataStmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer eventDataRows.Close()

	var eventIds = []uuid.UUID{}
	var eventID uuid.UUID
	for eventDataRows.Next() {
		if err := eventDataRows.Scan(&eventID); err != nil {
			return nil, err
		}

		eventIds = append(eventIds, eventID)
	}

	if eventDataRows.Err() != nil {
		return nil, eventDataRows.Err()
	}

	exceptionGroup.EventIDs = eventIds
	exceptionGroup.Count = len(eventIds)

	return exceptionGroup, nil
}

// GetExceptionGroupByFingerprint queries a single exception group by its fingerprint.
func (a App) GetExceptionGroupByFingerprint(ctx context.Context, fingerprint string) (exceptionGroup *group.ExceptionGroup, err error) {
	stmt := sqlf.PostgreSQL.
		From("public.unhandled_exception_groups").
		Select("id").
		Select("app_id").
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select("fingerprint").
		Select("first_event_timestamp").
		Select("created_at").
		Select("updated_at").
		Where("app_id = ?", a.ID).
		Where("fingerprint = ?", fingerprint)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if rows.Err() != nil {
		return
	}

	row, err := pgx.CollectOneRow(rows, pgx.RowToStructByNameLax[group.ExceptionGroup])
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	exceptionGroup = &row

	// Get list of event IDs
	eventDataStmt := sqlf.From(`default.events`).
		Select(`id`).
		Where(`exception.fingerprint = ?`, exceptionGroup.Fingerprint)

	eventDataRows, err := server.Server.ChPool.Query(ctx, eventDataStmt.String(), eventDataStmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer eventDataRows.Close()

	var eventIds = []uuid.UUID{}
	var eventID uuid.UUID
	for eventDataRows.Next() {
		if err := eventDataRows.Scan(&eventID); err != nil {
			return nil, err
		}

		eventIds = append(eventIds, eventID)
	}

	if eventDataRows.Err() != nil {
		return nil, eventDataRows.Err()
	}

	exceptionGroup.EventIDs = eventIds
	exceptionGroup.Count = len(eventIds)

	return exceptionGroup, nil
}

// GetExceptionGroups returns slice of ExceptionGroup
// of an app.
func (a App) GetExceptionGroupsWithFilter(ctx context.Context, af *filter.AppFilter) (groups []group.ExceptionGroup, err error) {
	stmt := sqlf.PostgreSQL.
		From("public.unhandled_exception_groups").
		Select("id").
		Select("app_id").
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select("fingerprint").
		Select("first_event_timestamp").
		Select("created_at").
		Select("updated_at").
		Where("app_id = ?", a.ID)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	exceptionGroups, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[group.ExceptionGroup])

	if err != nil {
		return nil, err
	}

	var exceptionGroup *group.ExceptionGroup
	for i := range exceptionGroups {
		exceptionGroup = &exceptionGroups[i]

		eventDataStmt := sqlf.
			From("default.events").
			Select("id").
			Where("exception.fingerprint = ?", exceptionGroup.Fingerprint)

		defer eventDataStmt.Close()

		if len(af.Versions) > 0 {
			eventDataStmt.Where("attribute.app_version").In(af.Versions)
		}

		if len(af.VersionCodes) > 0 {
			eventDataStmt.Where("attribute.app_build").In(af.VersionCodes)
		}

		if af.HasTimeRange() {
			eventDataStmt.Where("timestamp >= ? and timestamp <= ?", af.From, af.To)
		}

		rows, err := server.Server.ChPool.Query(ctx, eventDataStmt.String(), eventDataStmt.Args()...)
		if err != nil {
			return nil, err
		}

		defer rows.Close()

		var ids []uuid.UUID
		for rows.Next() {
			var id uuid.UUID
			if err := rows.Scan(&id); err != nil {
				return nil, err
			}

			ids = append(ids, id)
		}

		exceptionGroup.EventIDs = ids
		exceptionGroup.Count = len(ids)
	}

	return exceptionGroups, nil
}

// GetANRGroup queries a single ANR group by its id.
func (a App) GetANRGroup(ctx context.Context, id uuid.UUID) (anrGroup *group.ANRGroup, err error) {
	stmt := sqlf.PostgreSQL.
		From("public.anr_groups").
		Select("id").
		Select("app_id").
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select("fingerprint").
		Select("first_event_timestamp").
		Select("created_at").
		Select("updated_at").
		Where("app_id = ?", a.ID).
		Where("id = ?", id)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if rows.Err() != nil {
		return
	}

	row, err := pgx.CollectOneRow(rows, pgx.RowToStructByNameLax[group.ANRGroup])
	if errors.Is(err, pgx.ErrNoRows) {
		err = nil
		return
	} else if err != nil {
		return
	}

	anrGroup = &row

	// Get list of event IDs
	eventDataStmt := sqlf.From(`default.events`).
		Select(`id`).
		Where(`anr.fingerprint = ?`, anrGroup.Fingerprint)

	eventDataRows, err := server.Server.ChPool.Query(ctx, eventDataStmt.String(), eventDataStmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer eventDataRows.Close()

	var eventIds = []uuid.UUID{}
	var eventID uuid.UUID
	for eventDataRows.Next() {
		if err := eventDataRows.Scan(&eventID); err != nil {
			return nil, err
		}

		eventIds = append(eventIds, eventID)
	}

	if eventDataRows.Err() != nil {
		return nil, eventDataRows.Err()
	}

	anrGroup.EventIDs = eventIds
	anrGroup.Count = len(eventIds)

	return anrGroup, nil
}

// GetANRGroupByFingerprint queries a single ANR group by its fingerprint.
func (a App) GetANRGroupByFingerprint(ctx context.Context, fingerprint string) (anrGroup *group.ANRGroup, err error) {
	stmt := sqlf.PostgreSQL.
		From("public.anr_groups").
		Select("id").
		Select("app_id").
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select("fingerprint").
		Select("first_event_timestamp").
		Select("created_at").
		Select("updated_at").
		Where("app_id = ?", a.ID).
		Where("fingerprint = ?", fingerprint)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if rows.Err() != nil {
		return
	}

	row, err := pgx.CollectOneRow(rows, pgx.RowToStructByNameLax[group.ANRGroup])
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	anrGroup = &row

	// Get list of event IDs
	eventDataStmt := sqlf.From(`default.events`).
		Select(`id`).
		Where(`anr.fingerprint = ?`, anrGroup.Fingerprint)

	eventDataRows, err := server.Server.ChPool.Query(ctx, eventDataStmt.String(), eventDataStmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer eventDataRows.Close()

	var eventIds = []uuid.UUID{}
	var eventID uuid.UUID
	for eventDataRows.Next() {
		if err := eventDataRows.Scan(&eventID); err != nil {
			return nil, err
		}

		eventIds = append(eventIds, eventID)
	}

	if eventDataRows.Err() != nil {
		return nil, eventDataRows.Err()
	}

	anrGroup.EventIDs = eventIds
	anrGroup.Count = len(eventIds)

	return anrGroup, nil
}

// GetANRGroups returns slice of ANRGroup of an app.
func (a App) GetANRGroupsWithFilter(ctx context.Context, af *filter.AppFilter) (groups []group.ANRGroup, err error) {
	stmt := sqlf.PostgreSQL.
		From("public.anr_groups").
		Select("id").
		Select("app_id").
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select("fingerprint").
		Select("first_event_timestamp").
		Select("created_at").
		Select("updated_at").
		Where("app_id = ?", a.ID)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	anrGroups, err := pgx.CollectRows(rows, pgx.RowToStructByNameLax[group.ANRGroup])

	if err != nil {
		return nil, err
	}

	var anrGroup *group.ANRGroup
	for i := range anrGroups {
		anrGroup = &anrGroups[i]

		eventDataStmt := sqlf.
			From("default.events").
			Select("id").
			Where("anr.fingerprint = ?", anrGroup.Fingerprint)

		defer eventDataStmt.Close()

		if len(af.Versions) > 0 {
			eventDataStmt.Where("attribute.app_version").In(af.Versions)
		}

		if len(af.VersionCodes) > 0 {
			eventDataStmt.Where("attribute.app_build").In(af.VersionCodes)
		}

		if af.HasTimeRange() {
			eventDataStmt.Where("timestamp >= ? and timestamp <= ?", af.From, af.To)
		}

		rows, err := server.Server.ChPool.Query(ctx, eventDataStmt.String(), eventDataStmt.Args()...)
		if err != nil {
			return nil, err
		}

		defer rows.Close()

		var ids []uuid.UUID
		for rows.Next() {
			var id uuid.UUID
			if err := rows.Scan(&id); err != nil {
				return nil, err
			}

			ids = append(ids, id)
		}

		anrGroup.EventIDs = ids
		anrGroup.Count = len(ids)
	}

	return anrGroups, nil
}

// GetSizeMetrics computes app size of the selected app version
// and delta size change between app size of the selected app version
// and average size of unselected app versions.
//
// Computation bails out if there are no events for selected app
// version.
func (a App) GetSizeMetrics(ctx context.Context, af *filter.AppFilter, versions filter.Versions) (size *metrics.SizeMetric, err error) {
	size = &metrics.SizeMetric{}
	stmt := sqlf.Select("count(id) as count").
		From("default.events").
		Where("app_id = ?", af.AppID).
		Where("`attribute.app_version` = ? and `attribute.app_build` = ?", af.Versions[0], af.VersionCodes[0]).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer stmt.Close()

	var count uint64

	if err := server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&count); err != nil {
		return nil, err
	}

	// no events for selected conditions found
	if count < 1 {
		size.SetNaNs()
		return
	}

	avgSizeStmt := sqlf.PostgreSQL.
		From("public.build_sizes").
		Select("round(avg(build_size), 2) as average_size").
		Where("app_id = ?", af.AppID)

	if versions.HasVersions() {
		var names []any
		var codes []any

		for _, v := range versions.Versions() {
			names = append(names, v)
		}

		for _, v := range versions.Codes() {
			codes = append(codes, v)
		}

		avgSizeStmt.
			Where("version_name").In(names...).
			Where("version_code").In(codes...)
	}

	sizeStmt := sqlf.PostgreSQL.
		With("avg_size", avgSizeStmt).
		Select("t1.average_size as average_app_size").
		Select("t2.build_size as selected_app_size").
		Select("(t2.build_size - t1.average_size) as delta").
		From("avg_size as t1, public.build_sizes as t2").
		Where("app_id = ?", af.AppID).
		Where("version_name = ?", af.Versions[0]).
		Where("version_code = ?", af.VersionCodes[0])

	defer sizeStmt.Close()

	if err := server.Server.PgPool.QueryRow(ctx, sizeStmt.String(), sizeStmt.Args()...).Scan(&size.AverageAppSize, &size.SelectedAppSize, &size.Delta); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	return
}

// GetCrashFreeMetrics computes crash free sessions percentage
// of selected app versions and ratio of crash free sessions
// percentage of selected app versions and crash free sessions
// percentage of unselected app versions.
func (a App) GetCrashFreeMetrics(ctx context.Context, af *filter.AppFilter, versions filter.Versions) (crashFree *metrics.CrashFreeSession, err error) {
	crashFree = &metrics.CrashFreeSession{}

	stmt := sqlf.
		With("all_sessions",
			sqlf.From("default.events").
				Select("session_id, attribute.app_version, attribute.app_build, type, exception.handled").
				Where(`app_id = ? and timestamp >= ? and timestamp <= ?`, af.AppID, af.From, af.To)).
		With("t1",
			sqlf.From("all_sessions").
				Select("count(distinct session_id) as total_sessions_selected").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", af.Versions, af.VersionCodes)).
		With("t2",
			sqlf.From("all_sessions").
				Select("count(distinct session_id) as count_exception_selected").
				Where("`type` = 'exception' and `exception.handled` = false").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", af.Versions, af.VersionCodes))

	defer stmt.Close()

	dest := []any{&crashFree.CrashFreeSessions}
	var crashFreeUnselected float64

	if !versions.HasVersions() {
		stmt.
			Select("round((1 - (t2.count_exception_selected / t1.total_sessions_selected)) * 100, 2) as crash_free_sessions_selected").
			From("t1, t2")
	} else {
		stmt.
			With("t3",
				sqlf.From("all_sessions").
					Select("count(distinct session_id) as total_sessions_unselected").
					Where("attribute.app_version in ? and attribute.app_build in ?", versions.Versions(), versions.Codes())).
			With("t4", sqlf.From("all_sessions").
				Select("count(distinct session_id) as count_exception_unselected").
				Where("`type` = 'exception' and `exception.handled` = false").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", versions.Versions(), versions.Codes())).
			Select("round((1 - (t2.count_exception_selected / t1.total_sessions_selected)) * 100, 2) as crash_free_sessions_selected").
			Select("round((1 - (t4.count_exception_unselected / t3.total_sessions_unselected)) * 100, 2) as crash_free_sessions_unselected").
			From("t1, t2, t3, t4")

		dest = append(dest, &crashFreeUnselected)
	}

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(dest...); err != nil {
		return
	}

	if versions.HasVersions() {
		// avoid division by zero
		if crashFreeUnselected != 0 {
			crashFree.Delta = crashFree.CrashFreeSessions / crashFreeUnselected
		} else {
			crashFree.Delta = 1
		}
	} else {
		// because if there are no unselected
		// app versions, then:
		// crash free sessions of unselected app versions = crash free sessions of selected app versions
		// ratio between the two, will be always 1
		if crashFree.CrashFreeSessions != 0 {
			crashFree.Delta = 1
		}
	}

	crashFree.SetNaNs()

	return
}

// GetPerceivedCrashFreeMetrics computes perceived crash
// free sessions percentage of selected app versions and
// ratio of perceived crash free sessions percentage of
// selected app versions and perceived crash free sessions
// percentage of unselected app versions.
func (a App) GetPerceivedCrashFreeMetrics(ctx context.Context, af *filter.AppFilter, versions filter.Versions) (crashFree *metrics.PerceivedCrashFreeSession, err error) {
	crashFree = &metrics.PerceivedCrashFreeSession{}
	stmt := sqlf.
		With("all_sessions",
			sqlf.From("default.events").
				Select("session_id, attribute.app_version, attribute.app_build, type, exception.handled, exception.foreground").
				Where(`app_id = ? and timestamp >= ? and timestamp <= ?`, af.AppID, af.From, af.To)).
		With("t1",
			sqlf.From("all_sessions").
				Select("count(distinct session_id) as total_sessions_selected").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", af.Versions, af.VersionCodes)).
		With("t2",
			sqlf.From("all_sessions").
				Select("count(distinct session_id) as count_exception_selected").
				Where("`type` = 'exception' and `exception.handled` = false and `exception.foreground` = true").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", af.Versions, af.VersionCodes))

	defer stmt.Close()

	dest := []any{&crashFree.CrashFreeSessions}
	var crashFreeUnselected float64

	if !versions.HasVersions() {
		stmt.
			Select("round((1 - (t2.count_exception_selected / t1.total_sessions_selected)) * 100, 2) as crash_free_sessions_selected").
			From("t1, t2")
	} else {
		stmt.
			With("t3",
				sqlf.From("all_sessions").
					Select("count(distinct session_id) as total_sessions_unselected").
					Where("attribute.app_version in ? and attribute.app_build in ?", versions.Versions(), versions.Codes())).
			With("t4", sqlf.From("all_sessions").
				Select("count(distinct session_id) as count_exception_unselected").
				Where("`type` = 'exception' and `exception.handled` = false").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", versions.Versions(), versions.Codes())).
			Select("round((1 - (t2.count_exception_selected / t1.total_sessions_selected)) * 100, 2) as crash_free_sessions_selected").
			Select("round((1 - (t4.count_exception_unselected / t3.total_sessions_unselected)) * 100, 2) as crash_free_sessions_unselected").
			From("t1, t2, t3, t4")

		dest = append(dest, &crashFreeUnselected)
	}

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(dest...); err != nil {
		return
	}

	if versions.HasVersions() {
		// avoid division by zero
		if crashFreeUnselected != 0 {
			crashFree.Delta = crashFree.CrashFreeSessions / crashFreeUnselected
		} else {
			crashFree.Delta = 1
		}
	} else {
		// because if there are no unselected
		// app versions, then:
		// crash free sessions of unselected app versions = crash free sessions of selected app versions
		// ratio between the two, will be always 1
		if crashFree.CrashFreeSessions != 0 {
			crashFree.Delta = 1
		}
	}

	crashFree.SetNaNs()

	return
}

// GetANRFreeMetrics computes ANR free sessions percentage
// of selected app versions and ratio of ANR free sessions
// percentage of selected app versions and ANR free sessions
// percentage of unselected app versions.
func (a App) GetANRFreeMetrics(ctx context.Context, af *filter.AppFilter, versions filter.Versions) (anrFree *metrics.ANRFreeSession, err error) {
	anrFree = &metrics.ANRFreeSession{}
	stmt := sqlf.
		With("all_sessions",
			sqlf.From("default.events").
				Select("session_id, attribute.app_version, attribute.app_build, type").
				Where(`app_id = ? and timestamp >= ? and timestamp <= ?`, af.AppID, af.From, af.To)).
		With("t1",
			sqlf.From("all_sessions").
				Select("count(distinct session_id) as total_sessions_selected").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", af.Versions, af.VersionCodes)).
		With("t2",
			sqlf.From("all_sessions").
				Select("count(distinct session_id) as count_anr_selected").
				Where("`type` = 'anr'").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", af.Versions, af.VersionCodes))

	defer stmt.Close()

	dest := []any{&anrFree.ANRFreeSessions}
	var anrFreeUnselected float64

	if !versions.HasVersions() {
		stmt.
			Select("round((1 - (t2.count_anr_selected / t1.total_sessions_selected)) * 100, 2) as anr_free_sessions_selected").
			From("t1, t2")
	} else {
		stmt.
			With("t3",
				sqlf.From("all_sessions").
					Select("count(distinct session_id) as total_sessions_unselected").
					Where("attribute.app_version in ? and attribute.app_build in ?", versions.Versions(), versions.Codes())).
			With("t4", sqlf.From("all_sessions").
				Select("count(distinct session_id) as count_anr_unselected").
				Where("`type` = 'anr'").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", versions.Versions(), versions.Codes())).
			Select("round((1 - (t2.count_anr_selected / t1.total_sessions_selected)) * 100, 2) as anr_free_sessions_selected").
			Select("round((1 - (t4.count_anr_unselected / t3.total_sessions_unselected)) * 100, 2) as anr_free_sessions_unselected").
			From("t1, t2, t3, t4")

		dest = append(dest, &anrFreeUnselected)
	}

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(dest...); err != nil {
		return
	}

	if versions.HasVersions() {
		// avoid division by zero
		if anrFreeUnselected != 0 {
			anrFree.Delta = anrFree.ANRFreeSessions / anrFreeUnselected
		} else {
			anrFree.Delta = 1
		}
	} else {
		// because if there are no unselected
		// app versions, then:
		// anr free sessions of unselected app versions = anr free sessions of selected app versions
		// ratio between the two, will be always 1
		if anrFree.ANRFreeSessions != 0 {
			anrFree.Delta = 1
		}
	}

	anrFree.SetNaNs()

	return
}

// GetPerceivedANRFreeMetrics computes perceived ANR
// free sessions percentage of selected app versions and
// ratio of perceived ANR free sessions percentage of
// selected app versions and perceived ANR free sessions
// percentage of unselected app versions.
func (a App) GetPerceivedANRFreeMetrics(ctx context.Context, af *filter.AppFilter, versions filter.Versions) (anrFree *metrics.PerceivedANRFreeSession, err error) {
	anrFree = &metrics.PerceivedANRFreeSession{}
	stmt := sqlf.
		With("all_sessions",
			sqlf.From("default.events").
				Select("session_id, attribute.app_version, attribute.app_build, type, anr.foreground").
				Where(`app_id = ? and timestamp >= ? and timestamp <= ?`, af.AppID, af.From, af.To)).
		With("t1",
			sqlf.From("all_sessions").
				Select("count(distinct session_id) as total_sessions_selected").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", af.Versions, af.VersionCodes)).
		With("t2",
			sqlf.From("all_sessions").
				Select("count(distinct session_id) as count_anr_selected").
				Where("`type` = 'anr' and anr.foreground = true").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", af.Versions, af.VersionCodes))

	defer stmt.Close()

	dest := []any{&anrFree.ANRFreeSessions}
	var anrFreeUnselected float64

	if !versions.HasVersions() {
		stmt.
			Select("round((1 - (t2.count_anr_selected / t1.total_sessions_selected)) * 100, 2) as anr_free_sessions_selected").
			From("t1, t2")
	} else {
		stmt.
			With("t3",
				sqlf.From("all_sessions").
					Select("count(distinct session_id) as total_sessions_unselected").
					Where("attribute.app_version in ? and attribute.app_build in ?", versions.Versions(), versions.Codes())).
			With("t4", sqlf.From("all_sessions").
				Select("count(distinct session_id) as count_anr_unselected").
				Where("`type` = 'anr'").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", versions.Versions(), versions.Codes())).
			Select("round((1 - (t2.count_anr_selected / t1.total_sessions_selected)) * 100, 2) as anr_free_sessions_selected").
			Select("round((1 - (t4.count_anr_unselected / t3.total_sessions_unselected)) * 100, 2) as anr_free_sessions_unselected").
			From("t1, t2, t3, t4")

		dest = append(dest, &anrFreeUnselected)
	}

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(dest...); err != nil {
		return
	}

	if versions.HasVersions() {
		// avoid division by zero
		if anrFreeUnselected != 0 {
			anrFree.Delta = anrFree.ANRFreeSessions / anrFreeUnselected
		} else {
			anrFree.Delta = 1
		}
	} else {
		// because if there are no unselected
		// app versions, then:
		// anr free sessions of unselected app versions = anr free sessions of selected app versions
		// ratio between the two, will be always 1
		if anrFree.ANRFreeSessions != 0 {
			anrFree.Delta = 1
		}
	}

	anrFree.SetNaNs()

	return
}

// GetAdoptionMetrics computes adoption by computing sessions
// for selected versions and sessions of all versions for an app.
func (a App) GetAdoptionMetrics(ctx context.Context, af *filter.AppFilter) (adoption *metrics.SessionAdoption, err error) {
	adoption = &metrics.SessionAdoption{}
	stmt := sqlf.From("default.events").
		With("all_sessions",
			sqlf.From("default.events").
				Select("session_id, attribute.app_version, attribute.app_build").
				Where(`app_id = ? and timestamp >= ? and timestamp <= ?`, af.AppID, af.From, af.To)).
		With("all_versions",
			sqlf.From("all_sessions").
				Select("count(distinct session_id) as all_app_versions")).
		With("selected_versions",
			sqlf.From("all_sessions").
				Select("count(distinct session_id) as selected_app_versions").
				Where("`attribute.app_version` in ? and `attribute.app_build` in ?", af.Versions, af.VersionCodes)).
		Select("t1.all_app_versions as all_app_versions").
		Select("t2.selected_app_versions as selected_app_versions").
		Select("round((t2.selected_app_versions/t1.all_app_versions) * 100, 2) as adoption").
		From("all_versions as t1, selected_versions as t2")

	defer stmt.Close()

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&adoption.AllVersions, &adoption.SelectedVersion, &adoption.Adoption); err != nil {
		return
	}

	adoption.SetNaNs()

	return
}

// GetLaunchMetrics computes cold, warm and hot launch percentiles
// and deltas while respecting all applicable app filters.
// If at least 1 version pair exists, then delta is computed
// between launch metric values of selected versions and
// launch metric values of unselected versions.
func (a App) GetLaunchMetrics(ctx context.Context, af *filter.AppFilter, versions filter.Versions) (launch *metrics.LaunchMetric, err error) {
	launch = &metrics.LaunchMetric{}

	coldStmt := sqlf.From("timings").
		Select("round(quantile(0.95)(cold_launch.duration), 2) as cold_launch").
		Where("type = 'cold_launch' and cold_launch.duration > 0")

	warmStmt := sqlf.From("timings").
		Select("round(quantile(0.95)(warm_launch.duration), 2) as warm_launch").
		Where("type = 'warm_launch' and warm_launch.duration > 0")

	hotStmt := sqlf.From("timings").
		Select("round(quantile(0.95)(hot_launch.duration), 2) as hot_launch").
		Where("type = 'hot_launch' and hot_launch.duration > 0")

	if versions.HasVersions() {
		coldStmt.Where("attribute.app_version in ? and attribute.app_build in ?", versions.Versions(), versions.Codes())
		warmStmt.Where("attribute.app_version in ? and attribute.app_build in ?", versions.Versions(), versions.Codes())
		hotStmt.Where("attribute.app_version in ? and attribute.app_build in ?", versions.Versions(), versions.Codes())
	}

	stmt := sqlf.
		With("timings",
			sqlf.From("default.events").
				Select("type, cold_launch.duration, warm_launch.duration, hot_launch.duration, attribute.app_version, attribute.app_build").
				Where("app_id = ?", af.AppID).
				Where("timestamp >= ? and timestamp <= ?", af.From, af.To).
				Where("(type = 'cold_launch' or type = 'warm_launch' or type = 'hot_launch')")).
		With("cold_unselected", coldStmt).
		With("warm_unselected", warmStmt).
		With("hot_unselected", hotStmt).
		With("cold_selected",
			sqlf.From("timings").
				Select("round(quantile(0.95)(cold_launch.duration), 2) as cold_launch").
				Where("type = 'cold_launch'").
				Where("cold_launch.duration > 0").
				Where("cold_launch.duration <= 30000"). //ignore cold launch durations greater than 30 seconds. See https://github.com/measure-sh/measure/issues/933
				Where("attribute.app_version in ? and attribute.app_build in ?", af.Versions, af.VersionCodes)).
		With("warm_selected",
			sqlf.From("timings").
				Select("round(quantile(0.95)(warm_launch.duration), 2) as warm_launch").
				Where("type = 'warm_launch'").
				Where("warm_launch.duration > 0").
				Where("attribute.app_version in ? and attribute.app_build in ?", af.Versions, af.VersionCodes)).
		With("hot_selected",
			sqlf.From("timings").
				Select("round(quantile(0.95)(hot_launch.duration), 2) as hot_launch").
				Where("type = 'hot_launch'").
				Where("hot_launch.duration > 0").
				Where("attribute.app_version in ? and attribute.app_build in ?", af.Versions, af.VersionCodes)).
		Select("cold_selected.cold_launch as cold_launch_p95").
		Select("warm_selected.warm_launch as warm_launch_p95").
		Select("hot_selected.hot_launch as hot_launch_p95").
		Select("round(cold_selected.cold_launch / cold_unselected.cold_launch, 2) as cold_delta").
		Select("round(warm_selected.warm_launch / warm_unselected.warm_launch, 2) as warm_delta").
		Select("round(hot_selected.hot_launch / hot_unselected.hot_launch, 2) as hot_delta").
		From("cold_selected, warm_selected, hot_selected, cold_unselected, warm_unselected, hot_unselected")

	defer stmt.Close()

	if err := server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&launch.ColdLaunchP95, &launch.WarmLaunchP95, &launch.HotLaunchP95, &launch.ColdDelta, &launch.WarmDelta, &launch.ColdDelta); err != nil {
		return nil, err
	}

	launch.SetNaNs()

	return
}

// getJourneyEvents queries all relevant lifecycle
// and issue events involved in forming
// an implicit navigational journey.
func (a App) getJourneyEvents(ctx context.Context, af *filter.AppFilter, opts filter.JourneyOpts) (events []event.EventField, err error) {
	whereVals := []any{
		event.TypeLifecycleActivity,
		[]string{
			event.LifecycleActivityTypeCreated,
			event.LifecycleActivityTypeResumed,
		},
		event.TypeLifecycleFragment,
		[]string{
			event.LifecycleFragmentTypeAttached,
			event.LifecycleFragmentTypeResumed,
		},
	}

	if opts.All {
		whereVals = append(whereVals, event.TypeException, false, event.TypeANR)
	} else if opts.Exceptions {
		whereVals = append(whereVals, event.TypeException, false)
	} else if opts.ANRs {
		whereVals = append(whereVals, event.TypeANR)
	}

	stmt := sqlf.
		From(`default.events`).
		Select(`id`).
		Select(`toString(type)`).
		Select(`timestamp`).
		Select(`session_id`).
		Select(`toString(lifecycle_activity.type)`).
		Select(`toString(lifecycle_activity.class_name)`).
		Select(`toString(lifecycle_fragment.type)`).
		Select(`toString(lifecycle_fragment.class_name)`).
		Select(`toString(lifecycle_fragment.parent_activity)`).
		Select(`toString(lifecycle_fragment.parent_fragment)`).
		Where(`app_id = ?`, a.ID).
		Where("`timestamp` >= ? and `timestamp` <= ?", af.From, af.To)

	if len(af.Versions) > 0 {
		stmt.Where("`attribute.app_version` in ?", af.Versions)
	}

	if len(af.VersionCodes) > 0 {
		stmt.Where("`attribute.app_build` in ?", af.VersionCodes)
	}

	if opts.All {
		stmt.Where("((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` in ?) or ((type = ? and `exception.handled` = ?) or type = ?))", whereVals...)
	} else if opts.Exceptions {
		stmt.Where("((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` in ?) or (type = ? and `exception.handled` = ?))", whereVals...)
	} else if opts.ANRs {
		stmt.Where("((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` in ?) or (type = ?))", whereVals...)
	}

	if len(af.Countries) > 0 {
		stmt.Where("`inet.country_code` in ?", af.Countries)
	}

	if len(af.DeviceNames) > 0 {
		stmt.Where("`attribute.device_name` in ?", af.DeviceNames)
	}

	if len(af.DeviceManufacturers) > 0 {
		stmt.Where("`attribute.device_manufacturer` in ?", af.DeviceManufacturers)
	}

	if len(af.Locales) > 0 {
		stmt.Where("`attribute.device_locale` in ?", af.Locales)
	}

	if len(af.NetworkProviders) > 0 {
		stmt.Where("`attribute.network_provider` in ?", af.NetworkProviders)
	}

	if len(af.NetworkTypes) > 0 {
		stmt.Where("`attribute.network_type` in ?", af.NetworkTypes)
	}

	if len(af.NetworkGenerations) > 0 {
		stmt.Where("`attribute.network_generation` in ?", af.NetworkGenerations)
	}

	stmt.OrderBy(`timestamp`)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var ev event.EventField
		var lifecycleActivityType string
		var lifecycleActivityClassName string
		var lifecycleFragmentType string
		var lifecycleFragmentClassName string
		var lifecycleFragmentParentActivity string
		var lifecycleFragmentParentFragment string

		dest := []any{
			&ev.ID,
			&ev.Type,
			&ev.Timestamp,
			&ev.SessionID,
			&lifecycleActivityType,
			&lifecycleActivityClassName,
			&lifecycleFragmentType,
			&lifecycleFragmentClassName,
			&lifecycleFragmentParentActivity,
			&lifecycleFragmentParentFragment,
		}

		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}

		if ev.IsLifecycleActivity() {
			ev.LifecycleActivity = &event.LifecycleActivity{
				Type:      lifecycleActivityType,
				ClassName: lifecycleActivityClassName,
			}
		} else if ev.IsLifecycleFragment() {
			ev.LifecycleFragment = &event.LifecycleFragment{
				Type:           lifecycleFragmentType,
				ClassName:      lifecycleFragmentClassName,
				ParentActivity: lifecycleFragmentParentActivity,
				ParentFragment: lifecycleFragmentParentFragment,
			}
		} else if ev.IsException() {
			ev.Exception = &event.Exception{}
		} else if ev.IsANR() {
			ev.ANR = &event.ANR{}
		}

		events = append(events, ev)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return
}

func (a *App) add() (*APIKey, error) {
	id := uuid.New()
	a.ID = &id
	tx, err := server.Server.PgPool.Begin(context.Background())

	if err != nil {
		return nil, err
	}

	defer tx.Rollback(context.Background())

	_, err = tx.Exec(context.Background(), "insert into public.apps(id, team_id, app_name, created_at, updated_at) values ($1, $2, $3, $4, $5);", a.ID, a.TeamId, a.AppName, a.CreatedAt, a.UpdatedAt)

	if err != nil {
		return nil, err
	}

	apiKey, err := NewAPIKey(*a.ID)

	if err != nil {
		return nil, err
	}

	if err := apiKey.saveTx(tx); err != nil {
		return nil, err
	}

	if err := tx.Commit(context.Background()); err != nil {
		return nil, err
	}

	return apiKey, nil
}

func (a *App) getWithTeam(id uuid.UUID) (*App, error) {
	var appName pgtype.Text
	var uniqueId pgtype.Text
	var platform pgtype.Text
	var firstVersion pgtype.Text
	var onboarded pgtype.Bool
	var onboardedAt pgtype.Timestamptz
	var apiKeyLastSeen pgtype.Timestamptz
	var apiKeyCreatedAt pgtype.Timestamptz
	var createdAt pgtype.Timestamptz
	var updatedAt pgtype.Timestamptz

	apiKey := new(APIKey)

	cols := []string{
		"apps.app_name",
		"apps.unique_identifier",
		"apps.platform",
		"apps.first_version",
		"apps.onboarded",
		"apps.onboarded_at",
		"api_keys.key_prefix",
		"api_keys.key_value",
		"api_keys.checksum",
		"api_keys.last_seen",
		"api_keys.created_at",
		"apps.created_at",
		"apps.updated_at",
	}

	stmt := sqlf.PostgreSQL.
		Select(strings.Join(cols, ",")).
		From("public.apps").
		LeftJoin("public.api_keys", "api_keys.app_id = apps.id").
		Where("apps.id = ? and apps.team_id = ?", nil, nil)

	defer stmt.Close()

	dest := []any{
		&appName,
		&uniqueId,
		&platform,
		&firstVersion,
		&onboarded,
		&onboardedAt,
		&apiKey.keyPrefix,
		&apiKey.keyValue,
		&apiKey.checksum,
		&apiKeyLastSeen,
		&apiKeyCreatedAt,
		&createdAt,
		&updatedAt,
	}

	if err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), id, a.TeamId).Scan(dest...); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	if appName.Valid {
		a.AppName = appName.String
	}

	if uniqueId.Valid {
		a.UniqueId = uniqueId.String
	} else {
		a.UniqueId = ""
	}

	if platform.Valid {
		a.Platform = platform.String
	} else {
		a.Platform = ""
	}

	if firstVersion.Valid {
		a.FirstVersion = firstVersion.String
	} else {
		a.FirstVersion = ""
	}

	if onboarded.Valid {
		a.Onboarded = onboarded.Bool
	}

	if onboardedAt.Valid {
		a.OnboardedAt = onboardedAt.Time
	}

	if apiKeyLastSeen.Valid {
		apiKey.lastSeen = apiKeyLastSeen.Time
	}

	if apiKeyCreatedAt.Valid {
		apiKey.createdAt = apiKeyCreatedAt.Time
	}

	if createdAt.Valid {
		a.CreatedAt = createdAt.Time
	}

	if updatedAt.Valid {
		a.UpdatedAt = updatedAt.Time
	}

	a.APIKey = apiKey

	return a, nil
}

func (a *App) getTeam(ctx context.Context) (*Team, error) {
	team := &Team{}

	stmt := sqlf.PostgreSQL.
		Select("team_id").
		From("apps").
		Where("id = ?", nil)
	defer stmt.Close()

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), a.ID).Scan(&team.ID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	return team, nil
}

func (a *App) Onboard(ctx context.Context, tx *pgx.Tx, uniqueIdentifier, platform, firstVersion string) error {
	now := time.Now()
	stmt := sqlf.PostgreSQL.Update("public.apps").
		Set("onboarded", true).
		Set("unique_identifier", uniqueIdentifier).
		Set("platform", platform).
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

func (a *App) GetSessionEvents(ctx context.Context, sessionId uuid.UUID) (*Session, error) {
	cols := []string{
		`id`,
		`toString(type)`,
		`session_id`,
		`app_id`,
		`inet.ipv4`,
		`inet.ipv6`,
		`inet.country_code`,
		`timestamp`,
		`user_triggered`,
		`attachments`,
		`attribute.installation_id`,
		`toString(attribute.app_version)`,
		`toString(attribute.app_build)`,
		`toString(attribute.app_unique_id)`,
		`toString(attribute.platform)`,
		`toString(attribute.measure_sdk_version)`,
		`toString(attribute.thread_name)`,
		`toString(attribute.user_id)`,
		`toString(attribute.device_name)`,
		`toString(attribute.device_model)`,
		`toString(attribute.device_manufacturer)`,
		`toString(attribute.device_type)`,
		`attribute.device_is_foldable`,
		`attribute.device_is_physical`,
		`attribute.device_density_dpi`,
		`attribute.device_width_px`,
		`attribute.device_height_px`,
		`attribute.device_density`,
		`toString(attribute.device_locale)`,
		`toString(attribute.os_name)`,
		`toString(attribute.os_version)`,
		`toString(attribute.network_type)`,
		`toString(attribute.network_generation)`,
		`toString(attribute.network_provider)`,
		`anr.fingerprint`,
		`anr.foreground`,
		`anr.exceptions`,
		`anr.threads`,
		`exception.handled`,
		`exception.fingerprint`,
		`exception.foreground`,
		`exception.exceptions`,
		`exception.threads`,
		`toString(app_exit.reason)`,
		`toString(app_exit.importance)`,
		`app_exit.trace`,
		`app_exit.process_name`,
		`app_exit.pid`,
		`toString(string.severity_text)`,
		`string.string`,
		`toString(gesture_long_click.target)`,
		`toString(gesture_long_click.target_id)`,
		`gesture_long_click.touch_down_time`,
		`gesture_long_click.touch_up_time`,
		`gesture_long_click.width`,
		`gesture_long_click.height`,
		`gesture_long_click.x`,
		`gesture_long_click.y`,
		`toString(gesture_click.target)`,
		`toString(gesture_click.target_id)`,
		`gesture_click.touch_down_time`,
		`gesture_click.touch_up_time`,
		`gesture_click.width`,
		`gesture_click.height`,
		`gesture_click.x`,
		`gesture_click.y`,
		`toString(gesture_scroll.target)`,
		`toString(gesture_scroll.target_id)`,
		`gesture_scroll.touch_down_time`,
		`gesture_scroll.touch_up_time`,
		`gesture_scroll.x`,
		`gesture_scroll.y`,
		`gesture_scroll.end_x`,
		`gesture_scroll.end_y`,
		`toString(gesture_scroll.direction)`,
		`toString(lifecycle_activity.type)`,
		`toString(lifecycle_activity.class_name)`,
		`lifecycle_activity.intent`,
		`lifecycle_activity.saved_instance_state`,
		`toString(lifecycle_fragment.type)`,
		`toString(lifecycle_fragment.class_name)`,
		`lifecycle_fragment.parent_activity`,
		`lifecycle_fragment.parent_fragment`,
		`lifecycle_fragment.tag`,
		`toString(lifecycle_app.type)`,
		`cold_launch.process_start_uptime`,
		`cold_launch.process_start_requested_uptime`,
		`cold_launch.content_provider_attach_uptime`,
		`cold_launch.on_next_draw_uptime`,
		`toString(cold_launch.launched_activity)`,
		`cold_launch.has_saved_state`,
		`cold_launch.intent_data`,
		`cold_launch.duration`,
		`warm_launch.app_visible_uptime`,
		`warm_launch.on_next_draw_uptime`,
		`warm_launch.launched_activity`,
		`warm_launch.has_saved_state`,
		`warm_launch.intent_data`,
		`warm_launch.duration`,
		`hot_launch.app_visible_uptime`,
		`hot_launch.on_next_draw_uptime`,
		`toString(hot_launch.launched_activity)`,
		`hot_launch.has_saved_state`,
		`hot_launch.intent_data`,
		`hot_launch.duration`,
		`toString(network_change.network_type)`,
		`toString(network_change.previous_network_type)`,
		`toString(network_change.network_generation)`,
		`toString(network_change.previous_network_generation)`,
		`toString(network_change.network_provider)`,
		`http.url`,
		`toString(http.method)`,
		`http.status_code`,
		`http.start_time`,
		`http.end_time`,
		`http_request_headers`,
		`http_response_headers`,
		`http.request_body`,
		`http.response_body`,
		`http.failure_reason`,
		`http.failure_description`,
		`toString(http.client)`,
		`memory_usage.java_max_heap`,
		`memory_usage.java_total_heap`,
		`memory_usage.java_free_heap`,
		`memory_usage.total_pss`,
		`memory_usage.rss`,
		`memory_usage.native_total_heap`,
		`memory_usage.native_free_heap`,
		`memory_usage.interval`,
		`low_memory.java_max_heap`,
		`low_memory.java_total_heap`,
		`low_memory.java_free_heap`,
		`low_memory.total_pss`,
		`low_memory.rss`,
		`low_memory.native_total_heap`,
		`low_memory.native_free_heap`,
		`toString(trim_memory.level)`,
		`cpu_usage.num_cores`,
		`cpu_usage.clock_speed`,
		`cpu_usage.start_time`,
		`cpu_usage.uptime`,
		`cpu_usage.utime`,
		`cpu_usage.cutime`,
		`cpu_usage.stime`,
		`cpu_usage.cstime`,
		`cpu_usage.interval`,
		`cpu_usage.percentage_usage`,
		`toString(navigation.to)`,
		`toString(navigation.from)`,
		`toString(navigation.source)`,
	}

	stmt := sqlf.From("default.events")
	defer stmt.Close()

	for i := range cols {
		stmt.Select(cols[i])
	}

	stmt.Where("app_id = ? and session_id = ?", a.ID, sessionId)
	stmt.OrderBy("timestamp")

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)

	if err != nil {
		return nil, err
	}

	var session Session

	for rows.Next() {
		var ev event.EventField
		var anr event.ANR
		var exception event.Exception
		var exceptionExceptions string
		var exceptionThreads string
		var anrExceptions string
		var anrThreads string
		var attachments string

		var appExit event.AppExit
		var logString event.LogString
		var gestureLongClick event.GestureLongClick
		var gestureClick event.GestureClick
		var gestureScroll event.GestureScroll
		var lifecycleActivity event.LifecycleActivity
		var lifecycleFragment event.LifecycleFragment
		var lifecycleApp event.LifecycleApp
		var coldLaunch event.ColdLaunch
		var warmLaunch event.WarmLaunch
		var hotLaunch event.HotLaunch
		var networkChange event.NetworkChange
		var http event.Http
		var memoryUsage event.MemoryUsage
		var lowMemory event.LowMemory
		var trimMemory event.TrimMemory
		var cpuUsage event.CPUUsage
		var navigation event.Navigation

		var coldLaunchDuration uint32
		var warmLaunchDuration uint32
		var hotLaunchDuration uint32

		dest := []any{
			&ev.ID,
			&ev.Type,
			&session.SessionID,
			&session.AppID,
			&ev.IPv4,
			&ev.IPv6,
			&ev.CountryCode,
			&ev.Timestamp,
			&ev.UserTriggered,
			&attachments,

			// attribute
			&ev.Attribute.InstallationID,
			&ev.Attribute.AppVersion,
			&ev.Attribute.AppBuild,
			&ev.Attribute.AppUniqueID,
			&ev.Attribute.Platform,
			&ev.Attribute.MeasureSDKVersion,
			&ev.Attribute.ThreadName,
			&ev.Attribute.UserID,
			&ev.Attribute.DeviceName,
			&ev.Attribute.DeviceModel,
			&ev.Attribute.DeviceManufacturer,
			&ev.Attribute.DeviceType,
			&ev.Attribute.DeviceIsFoldable,
			&ev.Attribute.DeviceIsPhysical,
			&ev.Attribute.DeviceDensityDPI,
			&ev.Attribute.DeviceWidthPX,
			&ev.Attribute.DeviceHeightPX,
			&ev.Attribute.DeviceDensity,
			&ev.Attribute.DeviceLocale,
			&ev.Attribute.OSName,
			&ev.Attribute.OSVersion,
			&ev.Attribute.NetworkType,
			&ev.Attribute.NetworkGeneration,
			&ev.Attribute.NetworkProvider,

			// anr
			&anr.Fingerprint,
			&anr.Foreground,
			&anrExceptions,
			&anrThreads,

			// excpetion
			&exception.Handled,
			&exception.Fingerprint,
			&exception.Foreground,
			&exceptionExceptions,
			&exceptionThreads,

			// app exit
			&appExit.Reason,
			&appExit.Importance,
			&appExit.Trace,
			&appExit.ProcessName,
			&appExit.PID,

			// log string
			&logString.SeverityText,
			&logString.String,

			// gesture long click
			&gestureLongClick.Target,
			&gestureLongClick.TargetID,
			&gestureLongClick.TouchDownTime,
			&gestureLongClick.TouchUpTime,
			&gestureLongClick.Width,
			&gestureLongClick.Height,
			&gestureLongClick.X,
			&gestureLongClick.Y,

			// gesture click
			&gestureClick.Target,
			&gestureClick.TargetID,
			&gestureClick.TouchDownTime,
			&gestureClick.TouchUpTime,
			&gestureClick.Width,
			&gestureClick.Height,
			&gestureClick.X,
			&gestureClick.Y,

			// gesture scroll
			&gestureScroll.Target,
			&gestureScroll.TargetID,
			&gestureScroll.TouchDownTime,
			&gestureScroll.TouchUpTime,
			&gestureScroll.X,
			&gestureScroll.Y,
			&gestureScroll.EndX,
			&gestureScroll.EndY,
			&gestureScroll.Direction,

			// lifecycle activity
			&lifecycleActivity.Type,
			&lifecycleActivity.ClassName,
			&lifecycleActivity.Intent,
			&lifecycleActivity.SavedInstanceState,

			// lifecycle fragment
			&lifecycleFragment.Type,
			&lifecycleFragment.ClassName,
			&lifecycleFragment.ParentActivity,
			&lifecycleFragment.ParentFragment,
			&lifecycleFragment.Tag,

			// lifecycle app
			&lifecycleApp.Type,

			// cold launch
			&coldLaunch.ProcessStartUptime,
			&coldLaunch.ProcessStartRequestedUptime,
			&coldLaunch.ContentProviderAttachUptime,
			&coldLaunch.OnNextDrawUptime,
			&coldLaunch.LaunchedActivity,
			&coldLaunch.HasSavedState,
			&coldLaunch.IntentData,
			&coldLaunchDuration,

			// warm launch
			&warmLaunch.AppVisibleUptime,
			&warmLaunch.OnNextDrawUptime,
			&warmLaunch.LaunchedActivity,
			&warmLaunch.HasSavedState,
			&warmLaunch.IntentData,
			&warmLaunchDuration,

			// hot launch
			&hotLaunch.AppVisibleUptime,
			&hotLaunch.OnNextDrawUptime,
			&hotLaunch.LaunchedActivity,
			&hotLaunch.HasSavedState,
			&hotLaunch.IntentData,
			&hotLaunchDuration,

			// network change
			&networkChange.NetworkType,
			&networkChange.PreviousNetworkType,
			&networkChange.NetworkGeneration,
			&networkChange.PreviousNetworkGeneration,
			&networkChange.NetworkProvider,

			// http
			&http.URL,
			&http.Method,
			&http.StatusCode,
			&http.StartTime,
			&http.EndTime,
			&http.RequestHeaders,
			&http.ResponseHeaders,
			&http.RequestBody,
			&http.ResponseBody,
			&http.FailureReason,
			&http.FailureDescription,
			&http.Client,

			// memory usage
			&memoryUsage.JavaMaxHeap,
			&memoryUsage.JavaTotalHeap,
			&memoryUsage.JavaFreeHeap,
			&memoryUsage.TotalPSS,
			&memoryUsage.RSS,
			&memoryUsage.NativeTotalHeap,
			&memoryUsage.NativeFreeHeap,
			&memoryUsage.Interval,

			// low memory
			&lowMemory.JavaMaxHeap,
			&lowMemory.JavaTotalHeap,
			&lowMemory.JavaFreeHeap,
			&lowMemory.TotalPSS,
			&lowMemory.RSS,
			&lowMemory.NativeTotalHeap,
			&lowMemory.NativeFreeHeap,

			// trim memory
			&trimMemory.Level,

			// cpu usage
			&cpuUsage.NumCores,
			&cpuUsage.ClockSpeed,
			&cpuUsage.StartTime,
			&cpuUsage.Uptime,
			&cpuUsage.UTime,
			&cpuUsage.CUTime,
			&cpuUsage.STime,
			&cpuUsage.CSTime,
			&cpuUsage.Interval,
			&cpuUsage.PercentageUsage,

			// navigation
			&navigation.To,
			&navigation.From,
			&navigation.Source,
		}

		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}

		switch ev.Type {
		case event.TypeANR:
			if err := json.Unmarshal([]byte(anrExceptions), &anr.Exceptions); err != nil {
				return nil, err
			}
			if err := json.Unmarshal([]byte(anrThreads), &anr.Threads); err != nil {
				return nil, err
			}
			if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
				return nil, err
			}
			ev.ANR = &anr
			session.Events = append(session.Events, ev)
		case event.TypeException:
			if err := json.Unmarshal([]byte(exceptionExceptions), &exception.Exceptions); err != nil {
				return nil, err
			}
			if err := json.Unmarshal([]byte(exceptionThreads), &exception.Threads); err != nil {
				return nil, err
			}
			if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
				return nil, err
			}
			ev.Exception = &exception
			session.Events = append(session.Events, ev)
		case event.TypeAppExit:
			ev.AppExit = &appExit
			session.Events = append(session.Events, ev)
		case event.TypeString:
			ev.LogString = &logString
			session.Events = append(session.Events, ev)
		case event.TypeGestureLongClick:
			ev.GestureLongClick = &gestureLongClick
			session.Events = append(session.Events, ev)
		case event.TypeGestureClick:
			ev.GestureClick = &gestureClick
			session.Events = append(session.Events, ev)
		case event.TypeGestureScroll:
			ev.GestureScroll = &gestureScroll
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleActivity:
			ev.LifecycleActivity = &lifecycleActivity
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleFragment:
			ev.LifecycleFragment = &lifecycleFragment
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleApp:
			ev.LifecycleApp = &lifecycleApp
			session.Events = append(session.Events, ev)
		case event.TypeColdLaunch:
			ev.ColdLaunch = &coldLaunch
			ev.ColdLaunch.Duration = time.Duration(coldLaunchDuration)
			session.Events = append(session.Events, ev)
		case event.TypeWarmLaunch:
			ev.WarmLaunch = &warmLaunch
			ev.WarmLaunch.Duration = time.Duration(warmLaunchDuration)
			session.Events = append(session.Events, ev)
		case event.TypeHotLaunch:
			ev.HotLaunch = &hotLaunch
			ev.HotLaunch.Duration = time.Duration(hotLaunchDuration)
			session.Events = append(session.Events, ev)
		case event.TypeNetworkChange:
			ev.NetworkChange = &networkChange
			session.Events = append(session.Events, ev)
		case event.TypeHttp:
			ev.Http = &http
			session.Events = append(session.Events, ev)
		case event.TypeMemoryUsage:
			ev.MemoryUsage = &memoryUsage
			session.Events = append(session.Events, ev)
		case event.TypeLowMemory:
			ev.LowMemory = &lowMemory
			session.Events = append(session.Events, ev)
		case event.TypeTrimMemory:
			ev.TrimMemory = &trimMemory
			session.Events = append(session.Events, ev)
		case event.TypeCPUUsage:
			ev.CPUUsage = &cpuUsage
			session.Events = append(session.Events, ev)
		case event.TypeNavigation:
			ev.Navigation = &navigation
			session.Events = append(session.Events, ev)
		default:
			continue
		}
	}

	// attach session's first event attribute
	// as the session's attributes
	if len(session.Events) > 0 {
		attr := session.Events[0].Attribute
		session.Attribute = &attr
	}

	return &session, nil
}

func NewApp(teamId uuid.UUID) *App {
	now := time.Now()
	id := uuid.New()
	return &App{
		ID:        &id,
		TeamId:    teamId,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// SelectApp selects app by its id.
func SelectApp(ctx context.Context, id uuid.UUID) (app *App, err error) {
	var onboarded pgtype.Bool
	var uniqueId pgtype.Text
	var platform pgtype.Text
	var firstVersion pgtype.Text

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("onboarded").
		Select("unique_identifier").
		Select("platform").
		Select("first_version").
		From("public.apps").
		Where("id = ?", id)

	defer stmt.Close()

	if app == nil {
		app = &App{}
	}

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&app.ID, &onboarded, &uniqueId, &platform, &firstVersion); err != nil {
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

	if uniqueId.Valid {
		app.UniqueId = uniqueId.String
	} else {
		app.UniqueId = ""
	}

	if platform.Valid {
		app.Platform = platform.String
	} else {
		app.Platform = ""
	}

	if firstVersion.Valid {
		app.FirstVersion = firstVersion.String
	} else {
		app.FirstVersion = ""
	}

	return
}

func GetAppJourney(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		fmt.Println(err.Error())
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	af.Expand()

	msg := "app journey request validation failed"

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}

	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	msg = `failed to compute app's journey`
	opts := filter.JourneyOpts{
		All: true,
	}
	journeyEvents, err := app.getJourneyEvents(ctx, &af, opts)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	var issueEvents []event.EventField

	for i := range journeyEvents {
		if journeyEvents[i].IsUnhandledException() {
			issueEvents = append(issueEvents, journeyEvents[i])
		}
		if journeyEvents[i].IsANR() {
			issueEvents = append(issueEvents, journeyEvents[i])
		}
	}

	journeyAndroid := journey.NewJourneyAndroid(journeyEvents, &journey.Options{
		BiGraph: af.BiGraph,
	})

	if err := journeyAndroid.SetNodeExceptionGroups(func(eventIds []uuid.UUID) ([]group.ExceptionGroup, error) {
		exceptionGroups, err := group.GetExceptionGroupsFromExceptionIds(ctx, eventIds)
		if err != nil {
			return nil, err
		}
		return exceptionGroups, nil
	}); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if err := journeyAndroid.SetNodeANRGroups(func(eventIds []uuid.UUID) ([]group.ANRGroup, error) {
		anrGroups, err := group.GetANRGroupsFromANRIds(ctx, eventIds)
		if err != nil {
			return nil, err
		}
		return anrGroups, nil
	}); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type Link struct {
		Source string `json:"source"`
		Target string `json:"target"`
		Value  int    `json:"value"`
	}

	type Issue struct {
		ID    uuid.UUID `json:"id"`
		Title string    `json:"title"`
		Count int       `json:"count"`
	}

	type Node struct {
		ID     string `json:"id"`
		Issues gin.H  `json:"issues"`
	}

	var nodes []Node
	var links []Link

	for v := range journeyAndroid.Graph.Order() {
		journeyAndroid.Graph.Visit(v, func(w int, c int64) bool {
			var link Link
			link.Source = journeyAndroid.GetNodeName(v)
			link.Target = journeyAndroid.GetNodeName(w)
			link.Value = journeyAndroid.GetEdgeSessionCount(v, w)
			links = append(links, link)
			return false
		})
	}

	for _, v := range journeyAndroid.GetNodeVertices() {
		var node Node
		name := journeyAndroid.GetNodeName(v)
		exceptionGroups := journeyAndroid.GetNodeExceptionGroups(name)
		crashes := []Issue{}

		for i := range exceptionGroups {
			issue := Issue{
				ID:    exceptionGroups[i].ID,
				Title: exceptionGroups[i].GetDisplayTitle(),
				Count: journeyAndroid.GetNodeExceptionCount(v, exceptionGroups[i].ID),
			}
			crashes = append(crashes, issue)
		}

		// crashes are shown in descending order
		sort.Slice(crashes, func(i, j int) bool {
			return crashes[i].Count > crashes[j].Count
		})

		anrGroups := journeyAndroid.GetNodeANRGroups(name)
		anrs := []Issue{}

		for i := range anrGroups {
			issue := Issue{
				ID:    anrGroups[i].ID,
				Title: anrGroups[i].GetDisplayTitle(),
				Count: journeyAndroid.GetNodeANRCount(v, anrGroups[i].ID),
			}
			anrs = append(anrs, issue)
		}

		// ANRs are shown in descending order
		sort.Slice(anrs, func(i, j int) bool {
			return anrs[i].Count > anrs[j].Count
		})

		node.ID = name
		node.Issues = gin.H{
			"crashes": crashes,
			"anrs":    anrs,
		}
		nodes = append(nodes, node)
	}

	c.JSON(http.StatusOK, gin.H{
		"totalIssues": len(issueEvents),
		"nodes":       nodes,
		"links":       links,
	})
}

func GetAppMetrics(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse app metrics request`
		fmt.Println(msg, err.Error())
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	af.Expand()

	msg := `app metrics request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}

	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	msg = `failed to fetch app metrics`

	excludedVersions, err := af.GetExcludedVersions(ctx)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	launch, err := app.GetLaunchMetrics(ctx, &af, excludedVersions)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	adoption, err := app.GetAdoptionMetrics(ctx, &af)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	var sizes *metrics.SizeMetric = nil
	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 && !af.HasMultiVersions() {
		sizes, err = app.GetSizeMetrics(ctx, &af, excludedVersions)
		if err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
	}

	crashFree, err := app.GetCrashFreeMetrics(ctx, &af, excludedVersions)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	anrFree, err := app.GetANRFreeMetrics(ctx, &af, excludedVersions)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	perceivedCrashFree, err := app.GetPerceivedCrashFreeMetrics(ctx, &af, excludedVersions)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	perceivedANRFree, err := app.GetPerceivedANRFreeMetrics(ctx, &af, excludedVersions)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cold_launch": gin.H{
			"p95":   launch.ColdLaunchP95,
			"delta": launch.ColdDelta,
			"nan":   launch.ColdNaN,
		},
		"warm_launch": gin.H{
			"p95":   launch.WarmLaunchP95,
			"delta": launch.WarmDelta,
			"nan":   launch.WarmNaN,
		},
		"hot_launch": gin.H{
			"p95":   launch.HotLaunchP95,
			"delta": launch.HotDelta,
			"nan":   launch.HotNaN,
		},
		"adoption":                      adoption,
		"sizes":                         sizes,
		"crash_free_sessions":           crashFree,
		"anr_free_sessions":             anrFree,
		"perceived_crash_free_sessions": perceivedCrashFree,
		"perceived_anr_free_sessions":   perceivedANRFree,
	})
}

func GetAppFilters(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	ctx := c.Request.Context()

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if err := af.Validate(); err != nil {
		msg := "app filters request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	app := App{
		ID: &id,
	}

	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var fl filter.FilterList

	if err := af.GetGenericFilters(ctx, &fl); err != nil {
		msg := `failed to query app filters`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// club version names & version codes
	var versions []any
	for i := range fl.Versions {
		version := gin.H{"name": fl.Versions[i], "code": fl.VersionCodes[i]}
		versions = append(versions, version)
	}

	c.JSON(http.StatusOK, gin.H{
		"versions":             versions,
		"countries":            fl.Countries,
		"network_providers":    fl.NetworkProviders,
		"network_types":        fl.NetworkTypes,
		"network_generations":  fl.NetworkGenerations,
		"locales":              fl.DeviceLocales,
		"device_manufacturers": fl.DeviceManufacturers,
		"device_names":         fl.DeviceNames,
	})
}

func GetCrashOverview(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	af.Expand()

	msg := "crash overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	groups, err := app.GetExceptionGroupsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's exception groups with filter"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	var crashGroups []group.ExceptionGroup
	for i := range groups {
		// only consider those groups that have at least 1 exception
		// event
		if groups[i].Count > 0 {
			// omit `event_ids` field from JSON
			// response, because these can get really huge
			groups[i].EventIDs = nil

			crashGroups = append(crashGroups, groups[i])
		}
	}

	group.ComputeCrashContribution(crashGroups)
	group.SortExceptionGroups(crashGroups)
	crashGroups, next, previous := paginate.Paginate(crashGroups, &af)
	meta := gin.H{"next": next, "previous": previous}

	c.JSON(http.StatusOK, gin.H{
		"results": crashGroups,
		"meta":    meta,
	})
}

func GetCrashOverviewPlotInstances(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	af.Expand()
	msg := `crash overview request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	crashInstances, err := GetExceptionPlotInstances(ctx, &af)
	if err != nil {
		msg := `failed to query exception instances`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range crashInstances {
		instance := instance{
			ID: crashInstances[i].Version,
			Data: []gin.H{{
				"datetime":            crashInstances[i].DateTime,
				"instances":           crashInstances[i].Instances,
				"crash_free_sessions": crashInstances[i].IssueFreeSessions,
			}},
		}

		ndx, ok := lut[crashInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			lut[crashInstances[i].Version] = i
			instances = append(instances, instance)
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetCrashDetailCrashes(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	crashGroupId, err := uuid.Parse(c.Param("crashGroupId"))
	if err != nil {
		msg := `crash group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	af.Expand()

	msg := "app filters request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	group, err := app.GetExceptionGroup(ctx, crashGroupId)
	if err != nil {
		msg := fmt.Sprintf("failed to get exception group with id %q", crashGroupId.String())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if group == nil {
		msg := fmt.Sprintf("no exception group found with id %q", crashGroupId)
		fmt.Println(msg, err)
		c.JSON(http.StatusNotFound, gin.H{
			"error": msg,
		})
		return
	}

	eventExceptions, next, previous, err := GetExceptionsWithFilter(ctx, group.EventIDs, &af)
	if err != nil {
		msg := `failed to get exception group's exception events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// set appropriate attachment URLs
	for i := range eventExceptions {
		if len(eventExceptions[i].Attachments) > 0 {
			for j := range eventExceptions[i].Attachments {
				if err := eventExceptions[i].Attachments[j].PreSignURL(); err != nil {
					msg := `failed to generate URLs for attachment`
					fmt.Println(msg, err)
					c.JSON(http.StatusInternalServerError, gin.H{
						"error": msg,
					})
					return
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"results": eventExceptions,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetCrashDetailPlotInstances(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	crashGroupId, err := uuid.Parse(c.Param("crashGroupId"))
	if err != nil {
		msg := `crash group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	af.Expand()

	msg := "app filters request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	group, err := app.GetExceptionGroup(ctx, crashGroupId)
	if err != nil {
		msg := fmt.Sprintf("failed to get exception group with id %q", crashGroupId.String())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	crashInstances, err := GetIssuesPlot(ctx, group.EventIDs, &af)
	if err != nil {
		msg := `failed to query data for crash instances plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range crashInstances {
		instance := instance{
			ID: crashInstances[i].Version,
			Data: []gin.H{{
				"datetime":  crashInstances[i].DateTime,
				"instances": crashInstances[i].Instances,
			}},
		}

		ndx, ok := lut[crashInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			lut[crashInstances[i].Version] = i
			instances = append(instances, instance)
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetCrashDetailPlotJourney(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	crashGroupId, err := uuid.Parse(c.Param("crashGroupId"))
	if err != nil {
		msg := `crash group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	af.Expand()

	msg := `crash detail journey plot request validation failed`
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	exceptionGroup, err := app.GetExceptionGroup(ctx, crashGroupId)
	if err != nil {
		msg := fmt.Sprintf("failed to get exception group with id %q", crashGroupId.String())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	journeyEvents, err := app.getJourneyEvents(ctx, &af, filter.JourneyOpts{
		Exceptions: true,
	})
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	journeyAndroid := journey.NewJourneyAndroid(journeyEvents, &journey.Options{
		BiGraph:        af.BiGraph,
		ExceptionGroup: exceptionGroup,
	})

	if err := journeyAndroid.SetNodeExceptionGroups(func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error) {
		exceptionGroups = []group.ExceptionGroup{*exceptionGroup}
		return
	}); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type Link struct {
		Source string `json:"source"`
		Target string `json:"target"`
		Value  int    `json:"value"`
	}

	type Issue struct {
		ID    uuid.UUID `json:"id"`
		Title string    `json:"title"`
		Count int       `json:"count"`
	}

	type Node struct {
		ID     string `json:"id"`
		Issues gin.H  `json:"issues"`
	}

	var nodes []Node
	var links []Link

	for v := range journeyAndroid.Graph.Order() {
		journeyAndroid.Graph.Visit(v, func(w int, c int64) bool {
			var link Link
			link.Source = journeyAndroid.GetNodeName(v)
			link.Target = journeyAndroid.GetNodeName(w)
			link.Value = journeyAndroid.GetEdgeSessionCount(v, w)
			links = append(links, link)
			return false
		})
	}

	for _, v := range journeyAndroid.GetNodeVertices() {
		var node Node
		name := journeyAndroid.GetNodeName(v)
		exceptionGroups := journeyAndroid.GetNodeExceptionGroups(name)
		crashes := []Issue{}

		for i := range exceptionGroups {
			issue := Issue{
				ID:    exceptionGroups[i].ID,
				Title: exceptionGroups[i].GetDisplayTitle(),
				Count: journeyAndroid.GetNodeExceptionCount(v, exceptionGroups[i].ID),
			}
			if issue.Count > 0 {
				crashes = append(crashes, issue)
			}
		}

		sort.Slice(crashes, func(i, j int) bool {
			return crashes[i].Count > crashes[j].Count
		})

		node.ID = name
		node.Issues = gin.H{
			"crashes": crashes,
		}
		nodes = append(nodes, node)
	}

	c.JSON(http.StatusOK, gin.H{
		"totalIssues": len(exceptionGroup.EventIDs),
		"nodes":       nodes,
		"links":       links,
	})
}

func GetANROverview(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "anr overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	groups, err := app.GetANRGroupsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's anr groups matching filter"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	var anrGroups []group.ANRGroup
	for i := range groups {
		// only consider those groups that have at least 1 anr
		// event
		if groups[i].Count > 0 {
			// omit `event_ids` field from JSON
			// response, because these can get really huge
			groups[i].EventIDs = nil

			anrGroups = append(anrGroups, groups[i])
		}
	}

	group.ComputeANRContribution(anrGroups)
	group.SortANRGroups(anrGroups)
	anrGroups, next, previous := paginate.Paginate(anrGroups, &af)
	meta := gin.H{"next": next, "previous": previous}

	c.JSON(http.StatusOK, gin.H{"results": anrGroups, "meta": meta})
}

func GetANROverviewPlotInstances(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	af.Expand()

	msg := "ANR overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	anrInstances, err := GetANRPlotInstances(ctx, &af)
	if err != nil {
		msg := `failed to query exception instances`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range anrInstances {
		instance := instance{
			ID: anrInstances[i].Version,
			Data: []gin.H{{
				"datetime":          anrInstances[i].DateTime,
				"instances":         anrInstances[i].Instances,
				"anr_free_sessions": anrInstances[i].IssueFreeSessions,
			}},
		}

		ndx, ok := lut[anrInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			lut[anrInstances[i].Version] = i
			instances = append(instances, instance)
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetANRDetailANRs(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	anrGroupId, err := uuid.Parse(c.Param("anrGroupId"))
	if err != nil {
		msg := `anr group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	af.Expand()

	msg := "app filters request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	group, err := app.GetANRGroup(ctx, anrGroupId)
	if err != nil {
		msg := fmt.Sprintf("failed to get anr group with id %q", anrGroupId.String())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if group == nil {
		msg := fmt.Sprintf("no ANR group found with id %q", anrGroupId)
		fmt.Println(msg, err)
		c.JSON(http.StatusNotFound, gin.H{
			"error": msg,
		})
		return
	}

	eventANRs, next, previous, err := GetANRsWithFilter(ctx, group.EventIDs, &af)
	if err != nil {
		msg := `failed to get anr group's anr events`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	// set appropriate attachment URLs
	for i := range eventANRs {
		if len(eventANRs[i].Attachments) > 0 {
			for j := range eventANRs[i].Attachments {
				if err := eventANRs[i].Attachments[j].PreSignURL(); err != nil {
					msg := `failed to generate URLs for attachment`
					fmt.Println(msg, err)
					c.JSON(http.StatusInternalServerError, gin.H{
						"error": msg,
					})
					return
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"results": eventANRs,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetANRDetailPlotInstances(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	anrGroupId, err := uuid.Parse(c.Param("anrGroupId"))
	if err != nil {
		msg := `anr group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	af.Expand()

	msg := "app filters request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg, "details": err.Error()})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	group, err := app.GetANRGroup(ctx, anrGroupId)
	if err != nil {
		msg := fmt.Sprintf("failed to get anr group with id %q", anrGroupId.String())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	anrInstances, err := GetIssuesPlot(ctx, group.EventIDs, &af)
	if err != nil {
		msg := `failed to query data for anr instances plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range anrInstances {
		instance := instance{
			ID: anrInstances[i].Version,
			Data: []gin.H{{
				"datetime":  anrInstances[i].DateTime,
				"instances": anrInstances[i].Instances,
			}},
		}

		ndx, ok := lut[anrInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			lut[anrInstances[i].Version] = i
			instances = append(instances, instance)
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetANRDetailPlotJourney(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	anrGroupId, err := uuid.Parse(c.Param("anrGroupId"))
	if err != nil {
		msg := `ANR group id is invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	af.Expand()

	msg := `ANR detail journey plot request validation failed`
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	anrGroup, err := app.GetANRGroup(ctx, anrGroupId)
	if err != nil {
		msg := fmt.Sprintf("failed to get ANR group with id %q", anrGroupId.String())
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	journeyEvents, err := app.getJourneyEvents(ctx, &af, filter.JourneyOpts{
		ANRs: true,
	})
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	journeyAndroid := journey.NewJourneyAndroid(journeyEvents, &journey.Options{
		BiGraph:  af.BiGraph,
		ANRGroup: anrGroup,
	})

	if err := journeyAndroid.SetNodeANRGroups(func(eventIds []uuid.UUID) (anrGroups []group.ANRGroup, err error) {
		anrGroups = []group.ANRGroup{*anrGroup}
		return
	}); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type Link struct {
		Source string `json:"source"`
		Target string `json:"target"`
		Value  int    `json:"value"`
	}

	type Issue struct {
		ID    uuid.UUID `json:"id"`
		Title string    `json:"title"`
		Count int       `json:"count"`
	}

	type Node struct {
		ID     string `json:"id"`
		Issues gin.H  `json:"issues"`
	}

	var nodes []Node
	var links []Link

	for v := range journeyAndroid.Graph.Order() {
		journeyAndroid.Graph.Visit(v, func(w int, c int64) bool {
			var link Link
			link.Source = journeyAndroid.GetNodeName(v)
			link.Target = journeyAndroid.GetNodeName(w)
			link.Value = journeyAndroid.GetEdgeSessionCount(v, w)
			links = append(links, link)
			return false
		})
	}

	for _, v := range journeyAndroid.GetNodeVertices() {
		var node Node
		name := journeyAndroid.GetNodeName(v)
		anrGroups := journeyAndroid.GetNodeANRGroups(name)
		anrs := []Issue{}

		for i := range anrGroups {
			issue := Issue{
				ID:    anrGroups[i].ID,
				Title: anrGroups[i].GetDisplayTitle(),
				Count: journeyAndroid.GetNodeANRCount(v, anrGroups[i].ID),
			}
			if issue.Count > 0 {
				anrs = append(anrs, issue)
			}
		}

		sort.Slice(anrs, func(i, j int) bool {
			return anrs[i].Count > anrs[j].Count
		})

		node.ID = name
		node.Issues = gin.H{
			"anrs": anrs,
		}
		nodes = append(nodes, node)
	}

	c.JSON(http.StatusOK, gin.H{
		"totalIssues": len(anrGroup.EventIDs),
		"nodes":       nodes,
		"links":       links,
	})
}

func CreateApp(c *gin.Context) {
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, teamId.String(), *ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to create apps in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	app := NewApp(teamId)
	if err := c.ShouldBindJSON(&app); err != nil {
		msg := `failed to parse app json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	apiKey, err := app.add()

	if err != nil {
		msg := "failed to create app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	app.APIKey = apiKey

	c.JSON(http.StatusCreated, app)
}

func GetSessionsOverview(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	af.Expand()

	msg := "sessions overview request validation failed"
	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	sessions, err := app.GetSessionsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's sessions matching filter"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	sessions, next, previous := paginate.Paginate(sessions, &af)
	meta := gin.H{"next": next, "previous": previous}

	c.JSON(http.StatusOK, gin.H{"results": sessions, "meta": meta})
}

// GetSessionsWithFilters returns a slice of sessions of an app.
func (a App) GetSessionsWithFilter(ctx context.Context, af *filter.AppFilter) (sessions []Session, err error) {
	base := sqlf.
		From("default.events").
		Select("session_id").
		Select("app_id").
		Select("toString(any(attribute.app_version)) AS app_version").
		Select("toString(any(attribute.app_build)) AS app_build").
		Select("toString(any(attribute.user_id)) AS user_id").
		Select("toString(any(attribute.device_name)) AS device_name").
		Select("toString(any(attribute.device_model)) AS device_model").
		Select("toString(any(attribute.device_manufacturer)) AS device_manufacturer").
		Select("toString(any(attribute.os_name)) AS os_name").
		Select("toString(any(attribute.os_version)) AS os_version")

	if af.FreeText != "" {
		base.Select(
			"COALESCE("+
				"multiIf("+
				"any(attribute.user_id) ILIKE ?, concat('User ID: ', any(attribute.user_id)),"+
				"any(string.string) ILIKE ?, concat('Log: ', any(string.string)),"+
				"any(exception.exceptions) ILIKE ?, concat('Exception: ',any(exception.exceptions)),"+
				"any(anr.exceptions) ILIKE ?, concat('ANR: ', any(anr.exceptions)),"+
				"any(type) ILIKE ?, any(type),"+
				"any(lifecycle_activity.class_name) ILIKE ?, concat('Activity: ', any(lifecycle_activity.class_name)),"+
				"any(lifecycle_fragment.class_name) ILIKE ?, concat('Fragment: ', any(lifecycle_fragment.class_name)),"+
				"any(gesture_click.target_id) ILIKE ?, concat('Gesture Click: ', any(gesture_click.target_id)),"+
				"any(gesture_long_click.target_id) ILIKE ?, concat('Gesture Long Click: ', any(gesture_long_click.target_id)),"+
				"any(gesture_scroll.target_id) ILIKE ?, concat('Gesture Scroll: ', any(gesture_scroll.target_id)),"+
				"any(gesture_click.target) ILIKE ?, concat('Gesture Click: ', any(gesture_click.target)),"+
				"any(gesture_long_click.target) ILIKE ?, concat('Gesture Long Click: ', any(gesture_long_click.target)),"+
				"any(gesture_scroll.target) ILIKE ?, concat('Gesture Scroll: ', any(gesture_scroll.target)),"+
				"''"+
				")"+
				") AS matched_free_text",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%")
	} else {
		base.Select("'' AS matched_free_text")
	}

	base.Where("app_id = ?", af.AppID)

	if len(af.Versions) > 0 {
		base.Where("attribute.app_version").In(af.Versions)
	}

	if len(af.VersionCodes) > 0 {
		base.Where("attribute.app_build").In(af.VersionCodes)
	}

	if af.Crash && af.ANR {
		base.Where("((type = 'exception' AND exception.handled = false) OR type = 'anr')")
	} else if af.Crash {
		base.Where("type = 'exception' AND exception.handled = false")
	} else if af.ANR {
		base.Where("type = 'anr'")
	}

	if len(af.Countries) > 0 {
		base.Where("inet.country_code").In(af.Countries)
	}

	if len(af.DeviceNames) > 0 {
		base.Where("attribute.device_name").In(af.DeviceNames)
	}

	if len(af.DeviceManufacturers) > 0 {
		base.Where("attribute.device_manufacturer").In(af.DeviceManufacturers)
	}

	if len(af.Locales) > 0 {
		base.Where("attribute.device_locale").In(af.Locales)
	}

	if len(af.NetworkProviders) > 0 {
		base.Where("attribute.network_provider").In(af.NetworkProviders)
	}

	if len(af.NetworkTypes) > 0 {
		base.Where("attribute.network_type").In(af.NetworkTypes)
	}

	if len(af.NetworkGenerations) > 0 {
		base.Where("attribute.network_generation").In(af.NetworkGenerations)
	}

	if af.FreeText != "" {
		base.Where(
			"("+
				"attribute.user_id ILIKE ? OR "+
				"string.string ILIKE ? OR "+
				"toString(exception.exceptions) ILIKE ? OR "+
				"toString(anr.exceptions) ILIKE ? OR "+
				"type ILIKE ? OR "+
				"lifecycle_activity.class_name ILIKE ? OR "+
				"lifecycle_fragment.class_name ILIKE ? OR "+
				"gesture_click.target_id ILIKE ? OR "+
				"gesture_long_click.target_id ILIKE ? OR "+
				"gesture_scroll.target_id ILIKE ? OR "+
				"gesture_click.target ILIKE ? OR "+
				"gesture_long_click.target ILIKE ? OR "+
				"gesture_scroll.target ILIKE ?"+
				")",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%",
			"%"+af.FreeText+"%")
	}

	if af.HasTimeRange() {
		base.Where("timestamp >= ? and timestamp <= ?", af.From, af.To)
	}

	base.GroupBy("session_id, app_id")

	eventTimesStmt := sqlf.
		From("default.events").
		Select("session_id").
		Select("MIN(timestamp) AS first_event_time").
		Select("MAX(timestamp) AS last_event_time").
		Where("app_id = ?", af.AppID).
		GroupBy("session_id")

	stmt := sqlf.
		With("base_events", base).
		With("event_times", eventTimesStmt).
		From("base_events").
		Join("event_times e ", "base_events.session_id = e.session_id").
		Select("session_id").
		Select("app_id").
		Select("app_version").
		Select("app_build").
		Select("user_id").
		Select("device_name").
		Select("device_model").
		Select("device_manufacturer").
		Select("os_name").
		Select("os_version").
		Select("first_event_time").
		Select("last_event_time").
		Select("matched_free_text").
		OrderBy("first_event_time desc")

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	defer rows.Close()

	sessions = []Session{}
	for rows.Next() {
		var session Session
		session.Attribute = &event.Attribute{}

		if err := rows.Scan(&session.SessionID,
			&session.AppID,
			&session.Attribute.AppVersion,
			&session.Attribute.AppBuild,
			&session.Attribute.UserID,
			&session.Attribute.DeviceName,
			&session.Attribute.DeviceModel,
			&session.Attribute.DeviceManufacturer,
			&session.Attribute.OSName,
			&session.Attribute.OSVersion,
			&session.FirstEventTime,
			&session.LastEventTime,
			&session.MatchedFreeText); err != nil {
			return nil, err
		}

		if af.FreeText != "" {
			session.MatchedFreeText = extractShortenedMatchedFreeText(af.FreeText, session.MatchedFreeText)
		}

		session.Duration = session.DurationFromTimeStamps().Milliseconds()

		sessions = append(sessions, session)
	}

	return sessions, nil
}

func extractShortenedMatchedFreeText(inputFreeText, matchedFreeText string) string {
	matchedFreeTextForwardChars := 24
	matchedFreeTextBackwardChars := 24

	// Remove null padding that clickhouse adds in some cases
	matchedFreeText = strings.ReplaceAll(matchedFreeText, "\u0000", "")

	// Find the first occurrence of ':' in matchedFreeText and extract everything before it as the prefix
	colonIdx := strings.Index(matchedFreeText, ":")
	prefix := ""
	if colonIdx != -1 {
		prefix = matchedFreeText[:colonIdx+1]          // Include ':' in the prefix
		matchedFreeText = matchedFreeText[colonIdx+1:] // Remove the prefix from matchedFreeText
	}

	// Convert both strings to lowercase for case-insensitive comparison
	lowerInputFreeText := strings.ToLower(inputFreeText)
	lowerMatchedFreeText := strings.ToLower(matchedFreeText)

	// Find the index of inputFreeText in matchedFreeText (case-insensitive)
	idx := strings.Index(lowerMatchedFreeText, lowerInputFreeText)
	if idx == -1 {
		return "" // Substring not found
	}

	// Calculate the start and end positions for the padded substring
	start := idx - matchedFreeTextBackwardChars
	if start < 0 {
		start = 0
	}

	end := idx + len(inputFreeText) + matchedFreeTextForwardChars
	if end > len(matchedFreeText) {
		end = len(matchedFreeText)
	}

	// Extract the padded substring from the original matchedFreeText (not lowercased)
	result := matchedFreeText[start:end]

	// Return the prefix followed by the result
	return strings.TrimSpace(prefix + " " + result)
}

func GetSessionsOverviewPlot(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	af := filter.AppFilter{
		AppID: id,
		Limit: filter.DefaultPaginationLimit,
	}

	if err := c.ShouldBindQuery(&af); err != nil {
		msg := `failed to parse query parameters`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	af.Expand()
	msg := `sessions overview plot instances request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if len(af.Versions) > 0 || len(af.VersionCodes) > 0 {
		if err := af.ValidateVersions(); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   msg,
				"details": err.Error(),
			})
			return
		}
	}

	if !af.HasTimeRange() {
		af.SetDefaultTimeRange()
	}

	app := App{
		ID: &id,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	sessionInstances, err := GetSessionsPlot(ctx, &af)
	if err != nil {
		msg := `failed to query data for sessions overview plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range sessionInstances {
		instance := instance{
			ID: sessionInstances[i].Version,
			Data: []gin.H{{
				"datetime":  sessionInstances[i].DateTime,
				"instances": sessionInstances[i].Instances,
			}},
		}

		ndx, ok := lut[sessionInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			lut[sessionInstances[i].Version] = i
			instances = append(instances, instance)
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetSession(c *gin.Context) {
	ctx := c.Request.Context()
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	sessionId, err := uuid.Parse(c.Param("sessionId"))
	if err != nil {
		msg := `session id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := &App{
		ID: &appId,
	}
	team, err := app.getTeam(ctx)
	if err != nil {
		msg := `failed to fetch team from app`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf(`no team exists for app id: %q`, app.ID)
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userId := c.GetString("userId")

	ok, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team %q`, team.ID)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	ok, err = PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team %q`, team.ID)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	session, err := app.GetSessionEvents(ctx, sessionId)
	if err != nil {
		msg := `failed to fetch session data for replay`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if len(session.Events) < 1 {
		msg := fmt.Sprintf(`session %q for app %q does not exist`, sessionId, app.ID)
		c.JSON(http.StatusNotFound, gin.H{
			"error": msg,
		})
		return
	}

	// generate pre-sign URLs for
	// attachments
	for i := range session.Events {
		if !session.Events[i].HasAttachments() {
			continue
		}
		for j := range session.Events[i].Attachments {
			if err := session.Events[i].Attachments[j].PreSignURL(); err != nil {
				msg := `failed to generate URLs for attachment`
				fmt.Println(msg, err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": msg,
				})
				return
			}
		}
	}

	duration := session.DurationFromEvents().Milliseconds()
	cpuUsageEvents := session.EventsOfType(event.TypeCPUUsage)
	cpuUsages := replay.ComputeCPUUsage(cpuUsageEvents)

	memoryUsageEvents := session.EventsOfType(event.TypeMemoryUsage)
	memoryUsages := replay.ComputeMemoryUsage(memoryUsageEvents)

	typeList := []string{
		event.TypeGestureClick,
		event.TypeGestureLongClick,
		event.TypeGestureScroll,
		event.TypeNavigation,
		event.TypeString,
		event.TypeNetworkChange,
		event.TypeColdLaunch,
		event.TypeWarmLaunch,
		event.TypeHotLaunch,
		event.TypeLifecycleActivity,
		event.TypeLifecycleFragment,
		event.TypeLifecycleApp,
		event.TypeTrimMemory,
		event.TypeLowMemory,
		event.TypeAppExit,
		event.TypeException,
		event.TypeANR,
		event.TypeHttp,
	}

	eventMap := session.EventsOfTypes(typeList...)
	threads := make(replay.Threads)

	gestureClickEvents := eventMap[event.TypeGestureClick]
	if len(gestureClickEvents) > 0 {
		gestureClicks := replay.ComputeGestureClicks(gestureClickEvents)
		threadedGestureClicks := replay.GroupByThreads(gestureClicks)
		threads.Organize(event.TypeGestureClick, threadedGestureClicks)
	}

	gestureLongClickEvents := eventMap[event.TypeGestureLongClick]
	if len(gestureLongClickEvents) > 0 {
		gestureLongClicks := replay.ComputeGestureLongClicks(gestureLongClickEvents)
		threadedGestureLongClicks := replay.GroupByThreads(gestureLongClicks)
		threads.Organize(event.TypeGestureLongClick, threadedGestureLongClicks)
	}

	gestureScrollEvents := eventMap[event.TypeGestureScroll]
	if len(gestureScrollEvents) > 0 {
		gestureScrolls := replay.ComputeGestureScrolls(gestureScrollEvents)
		threadedGestureScrolls := replay.GroupByThreads(gestureScrolls)
		threads.Organize(event.TypeGestureScroll, threadedGestureScrolls)
	}

	navEvents := eventMap[event.TypeNavigation]
	if len(navEvents) > 0 {
		navs := replay.ComputeNavigation(navEvents)
		threadedNavs := replay.GroupByThreads(navs)
		threads.Organize(event.TypeNavigation, threadedNavs)
	}

	logEvents := eventMap[event.TypeString]
	if len(logEvents) > 0 {
		logs := replay.ComputeLogString(logEvents)
		threadedLogs := replay.GroupByThreads(logs)
		threads.Organize(event.TypeString, threadedLogs)
	}

	netChangeEvents := eventMap[event.TypeNetworkChange]
	if len(netChangeEvents) > 0 {
		netChanges := replay.ComputeNetworkChange(netChangeEvents)
		threadedNetChanges := replay.GroupByThreads(netChanges)
		threads.Organize(event.TypeNetworkChange, threadedNetChanges)
	}

	coldLaunchEvents := eventMap[event.TypeColdLaunch]
	if len(coldLaunchEvents) > 0 {
		coldLaunches := replay.ComputeColdLaunches(coldLaunchEvents)
		threadedColdLaunches := replay.GroupByThreads(coldLaunches)
		threads.Organize(event.TypeColdLaunch, threadedColdLaunches)
	}

	warmLaunchEvents := eventMap[event.TypeWarmLaunch]
	if len(warmLaunchEvents) > 0 {
		warmLaunches := replay.ComputeWarmLaunches(warmLaunchEvents)
		threadedWarmLaunches := replay.GroupByThreads(warmLaunches)
		threads.Organize(event.TypeWarmLaunch, threadedWarmLaunches)
	}

	hotLaunchEvents := eventMap[event.TypeHotLaunch]
	if len(hotLaunchEvents) > 0 {
		hotLaunches := replay.ComputeHotLaunches(hotLaunchEvents)
		threadedHotLaunches := replay.GroupByThreads(hotLaunches)
		threads.Organize(event.TypeHotLaunch, threadedHotLaunches)
	}

	lifecycleActivityEvents := eventMap[event.TypeLifecycleActivity]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleActivities := replay.ComputeLifecycleActivities(lifecycleActivityEvents)
		threadedLifecycleActivities := replay.GroupByThreads(lifecycleActivities)
		threads.Organize(event.TypeLifecycleActivity, threadedLifecycleActivities)
	}

	lifecycleFragmentEvents := eventMap[event.TypeLifecycleFragment]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleFragments := replay.ComputeLifecycleFragments(lifecycleFragmentEvents)
		threadedLifecycleFragments := replay.GroupByThreads(lifecycleFragments)
		threads.Organize(event.TypeLifecycleFragment, threadedLifecycleFragments)
	}

	lifecycleAppEvents := eventMap[event.TypeLifecycleApp]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleApps := replay.ComputeLifecycleApps(lifecycleAppEvents)
		threadedLifecycleApps := replay.GroupByThreads(lifecycleApps)
		threads.Organize(event.TypeLifecycleApp, threadedLifecycleApps)
	}

	trimMemoryEvents := eventMap[event.TypeTrimMemory]
	if len(trimMemoryEvents) > 0 {
		trimMemories := replay.ComputeTrimMemories(trimMemoryEvents)
		threadedTrimMemories := replay.GroupByThreads(trimMemories)
		threads.Organize(event.TypeTrimMemory, threadedTrimMemories)
	}

	lowMemoryEvents := eventMap[event.TypeLowMemory]
	if len(lowMemoryEvents) > 0 {
		lowMemories := replay.ComputeLowMemories(lowMemoryEvents)
		threadedLowMemories := replay.GroupByThreads(lowMemories)
		threads.Organize(event.TypeLowMemory, threadedLowMemories)
	}

	appExitEvents := eventMap[event.TypeAppExit]
	if len(appExitEvents) > 0 {
		appExits := replay.ComputeAppExits(appExitEvents)
		threadedAppExits := replay.GroupByThreads(appExits)
		threads.Organize(event.TypeAppExit, threadedAppExits)
	}

	exceptionEvents := eventMap[event.TypeException]
	if len(exceptionEvents) > 0 {
		exceptions := replay.ComputeExceptions(exceptionEvents)
		threadedExceptions := replay.GroupByThreads(exceptions)
		threads.Organize(event.TypeException, threadedExceptions)
	}

	anrEvents := eventMap[event.TypeANR]
	if len(anrEvents) > 0 {
		anrs := replay.ComputeANRs(anrEvents)
		threadedANRs := replay.GroupByThreads(anrs)
		threads.Organize(event.TypeANR, threadedANRs)
	}

	httpEvents := eventMap[event.TypeHttp]
	if len(httpEvents) > 0 {
		httpies := replay.ComputeHttp(httpEvents)
		threadedHttpies := replay.GroupByThreads(httpies)
		threads.Organize(event.TypeHttp, threadedHttpies)
	}

	threads.Sort()

	response := gin.H{
		"session_id":   sessionId,
		"attribute":    session.Attribute,
		"app_id":       appId,
		"duration":     duration,
		"cpu_usage":    cpuUsages,
		"memory_usage": memoryUsages,
		"threads":      threads,
	}

	c.JSON(http.StatusOK, response)
}

func GetAlertPrefs(c *gin.Context) {
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	userIdString := c.GetString("userId")

	userId, err := uuid.Parse(userIdString)
	if err != nil {
		fmt.Println("Error parsing userId:", err)
		return
	}

	alertPref, err := getAlertPref(appId, userId)
	if err != nil {
		msg := `unable to fetch notif prefs`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, alertPref)
}

func UpdateAlertPrefs(c *gin.Context) {
	userIdString := c.GetString("userId")

	userId, err := uuid.Parse(userIdString)
	if err != nil {
		fmt.Println("Error parsing userId:", err)
		return
	}

	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := "app id invalid or missing"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	alertPref := newAlertPref(appId, userId)

	var payload AlertPrefPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse alert preferences json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	alertPref.CrashRateSpikeEmail = payload.CrashRateSpike.Email
	alertPref.AnrRateSpikeEmail = payload.AnrRateSpike.Email
	alertPref.LaunchTimeSpikeEmail = payload.LaunchTimeSpike.Email

	alertPref.update()

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}

func GetAppSettings(c *gin.Context) {
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	appSettings, err := getAppSettings(appId)
	if err != nil {
		msg := `unable to fetch app settings`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, appSettings)
}

func UpdateAppSettings(c *gin.Context) {
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	app := App{
		ID: &appId,
	}

	team, err := app.getTeam(c)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	ok, err := PerformAuthz(userId, team.ID.String(), *ScopeAppAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to modify app settings in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	appSettings := newAppSettings(appId)

	var payload AppSettingsPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse alert preferences json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	appSettings.RetentionPeriod = payload.RetentionPeriod

	appSettings.update()

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}
