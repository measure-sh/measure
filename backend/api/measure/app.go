package measure

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"backend/api/event"
	"backend/api/filter"
	"backend/api/group"
	"backend/api/journey"
	"backend/api/metrics"
	"backend/api/numeric"
	"backend/api/opsys"
	"backend/api/paginate"
	"backend/api/server"
	"backend/api/span"
	"backend/api/timeline"

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
	OSName       string     `json:"os_name"`
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
		OSName      *string    `json:"os_name"`
		OnboardedAt *time.Time `json:"onboarded_at"`
		UniqueId    *string    `json:"unique_identifier"`
	}{
		OSName: func() *string {
			if a.OSName == "" {
				return nil
			}
			return &a.OSName
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

func (a App) rename() error {
	stmt := sqlf.PostgreSQL.Update("apps").
		Set("app_name", a.AppName).
		Set("updated_at", time.Now()).
		Where("id = ?", a.ID)
	defer stmt.Close()

	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), stmt.Args()...)
	if err != nil {
		return err
	}

	return nil
}

// GetExceptionGroup queries a single exception group by its id.
func (a App) GetExceptionGroup(ctx context.Context, id string) (exceptionGroup *group.ExceptionGroup, err error) {
	stmt := sqlf.
		From("unhandled_exception_groups").
		Clause("FINAL").
		Select("app_id").
		Select("id").
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select("updated_at").
		Where("app_id = ?", a.ID).
		Where("id = ?", id)

	defer stmt.Close()

	row := group.ExceptionGroup{}
	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if rows.Next() {
		if err := rows.Scan(
			&row.AppID,
			&row.ID,
			&row.Type,
			&row.Message,
			&row.MethodName,
			&row.FileName,
			&row.LineNumber,
			&row.UpdatedAt,
		); err != nil {
			return nil, err
		}
	} else {
		return nil, nil
	}

	exceptionGroup = &row

	// Get list of event IDs
	eventDataStmt := sqlf.From(`events`).
		Select(`distinct id`).
		Clause("prewhere app_id = toUUID(?) and exception.fingerprint = ?", a.ID, exceptionGroup.ID).
		Where("type = 'exception'").
		Where("exception.handled = false").
		GroupBy("id")

	defer eventDataStmt.Close()

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
		return
	}

	exceptionGroup.EventIDs = eventIds
	exceptionGroup.Count = len(eventIds)

	return
}

// GetExceptionGroups returns slice of ExceptionGroup
// of an app.
func (a App) GetExceptionGroupsWithFilter(ctx context.Context, af *filter.AppFilter) (groups []group.ExceptionGroup, err error) {
	stmt := sqlf.
		From("unhandled_exception_groups").
		Clause("FINAL").
		Select("app_id").
		Select("id").
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select("updated_at").
		Where("app_id = ?", a.ID)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var g group.ExceptionGroup
		if err := rows.Scan(
			&g.AppID,
			&g.ID,
			&g.Type,
			&g.Message,
			&g.MethodName,
			&g.FileName,
			&g.LineNumber,
			&g.UpdatedAt,
		); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	var exceptionGroup *group.ExceptionGroup
	for i := range groups {
		exceptionGroup = &groups[i]

		eventDataStmt := sqlf.
			From("events").
			Select("distinct id").
			Clause("prewhere app_id = toUUID(?) and exception.fingerprint = ?", af.AppID, exceptionGroup.ID).
			Where("type = ?", event.TypeException).
			Where("exception.handled = ?", false)

		defer eventDataStmt.Close()

		if af.HasUDExpression() && !af.UDExpression.Empty() {
			subQuery := sqlf.From("user_def_attrs").
				Select("event_id id").
				Clause("final").
				Where("app_id = toUUID(?)", af.AppID).
				Where("exception = true")
			af.UDExpression.Augment(subQuery)
			eventDataStmt.Clause("AND id in").SubQuery("(", ")", subQuery)
		}

		eventDataStmt.GroupBy("id")

		if len(af.Versions) > 0 {
			eventDataStmt.Where("attribute.app_version").In(af.Versions)
		}

		if len(af.VersionCodes) > 0 {
			eventDataStmt.Where("attribute.app_build").In(af.VersionCodes)
		}

		if len(af.OsNames) > 0 {
			eventDataStmt.Where("attribute.os_name").In(af.OsNames)
		}

		if len(af.OsVersions) > 0 {
			eventDataStmt.Where("attribute.os_version").In(af.OsVersions)
		}

		if len(af.Countries) > 0 {
			eventDataStmt.Where("inet.country_code").In(af.Countries)
		}

		if len(af.DeviceNames) > 0 {
			eventDataStmt.Where("attribute.device_name").In(af.DeviceNames)
		}

		if len(af.DeviceManufacturers) > 0 {
			eventDataStmt.Where("attribute.device_manufacturer").In(af.DeviceManufacturers)
		}

		if len(af.Locales) > 0 {
			eventDataStmt.Where("attribute.device_locale").In(af.Locales)
		}

		if len(af.NetworkProviders) > 0 {
			eventDataStmt.Where("attribute.network_provider").In(af.NetworkProviders)
		}

		if len(af.NetworkTypes) > 0 {
			eventDataStmt.Where("attribute.network_type").In(af.NetworkTypes)
		}

		if len(af.NetworkGenerations) > 0 {
			eventDataStmt.Where("attribute.network_generation").In(af.NetworkGenerations)
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

		if rows.Err() != nil {
			return nil, err
		}

		exceptionGroup.EventIDs = ids
		exceptionGroup.Count = len(ids)
	}

	return
}

// GetANRGroup queries a single ANR group by its id.
func (a App) GetANRGroup(ctx context.Context, id string) (anrGroup *group.ANRGroup, err error) {
	stmt := sqlf.
		From("anr_groups").
		Clause("FINAL").
		Select("app_id").
		Select("id").
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select("updated_at").
		Where("app_id = ?", a.ID).
		Where("id = ?", id)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	row := group.ANRGroup{}
	if rows.Next() {
		if err := rows.Scan(
			&row.AppID,
			&row.ID,
			&row.Type,
			&row.Message,
			&row.MethodName,
			&row.FileName,
			&row.LineNumber,
			&row.UpdatedAt,
		); err != nil {
			return nil, err
		}
	} else {
		return nil, nil
	}

	anrGroup = &row

	// Get list of event IDs
	eventDataStmt := sqlf.From(`events`).
		Select(`distinct id`).
		Clause("prewhere app_id = toUUID(?) and anr.fingerprint = ?", a.ID, anrGroup.ID).
		Where("type = ?", event.TypeANR).
		GroupBy("id")

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
	stmt := sqlf.
		From("anr_groups").
		Clause("FINAL").
		Select("app_id").
		Select("id").
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select("updated_at").
		Where("app_id = ?", a.ID)

	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var g group.ANRGroup
		if err := rows.Scan(
			&g.AppID,
			&g.ID,
			&g.Type,
			&g.Message,
			&g.MethodName,
			&g.FileName,
			&g.LineNumber,
			&g.UpdatedAt,
		); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	var anrGroup *group.ANRGroup
	for i := range groups {
		anrGroup = &groups[i]

		eventDataStmt := sqlf.
			From("events").
			Select("distinct id").
			Clause("prewhere app_id = toUUID(?) and anr.fingerprint = ?", af.AppID, anrGroup.ID).
			Where("type = ?", event.TypeANR)

		defer eventDataStmt.Close()

		if af.HasUDExpression() && !af.UDExpression.Empty() {
			subQuery := sqlf.From("user_def_attrs").
				Select("event_id id").
				Clause("final").
				Where("app_id = toUUID(?)", af.AppID)
			af.UDExpression.Augment(subQuery)
			eventDataStmt.Clause("AND id in").SubQuery("(", ")", subQuery)
		}

		eventDataStmt.GroupBy("id")

		if len(af.Versions) > 0 {
			eventDataStmt.Where("attribute.app_version").In(af.Versions)
		}

		if len(af.VersionCodes) > 0 {
			eventDataStmt.Where("attribute.app_build").In(af.VersionCodes)
		}

		if len(af.OsNames) > 0 {
			eventDataStmt.Where("attribute.os_name").In(af.OsNames)
		}

		if len(af.OsVersions) > 0 {
			eventDataStmt.Where("attribute.os_version").In(af.OsVersions)
		}

		if len(af.Countries) > 0 {
			eventDataStmt.Where("inet.country_code").In(af.Countries)
		}

		if len(af.DeviceNames) > 0 {
			eventDataStmt.Where("attribute.device_name").In(af.DeviceNames)
		}

		if len(af.DeviceManufacturers) > 0 {
			eventDataStmt.Where("attribute.device_manufacturer").In(af.DeviceManufacturers)
		}

		if len(af.Locales) > 0 {
			eventDataStmt.Where("attribute.device_locale").In(af.Locales)
		}

		if len(af.NetworkProviders) > 0 {
			eventDataStmt.Where("attribute.network_provider").In(af.NetworkProviders)
		}

		if len(af.NetworkTypes) > 0 {
			eventDataStmt.Where("attribute.network_type").In(af.NetworkTypes)
		}

		if len(af.NetworkGenerations) > 0 {
			eventDataStmt.Where("attribute.network_generation").In(af.NetworkGenerations)
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

		if rows.Err() != nil {
			return nil, err
		}

		anrGroup.EventIDs = ids
		anrGroup.Count = len(ids)
	}

	return
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
		From("events").
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
		From("build_sizes").
		Select("round(coalesce(avg(build_size), 2), 0) as average_size").
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
		From("avg_size as t1, build_sizes as t2").
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

// GetIssueFreeMetrics computes crash and anr free sessions
// percentage and its deltas.
//
// - Crash free sessions
// - Perceived crash free sessions
// - ANR free sessions
// - Perceived ANR free sessions
func (a App) GetIssueFreeMetrics(
	ctx context.Context,
	af *filter.AppFilter,
	unselectedVersions filter.Versions,
) (
	crashFree *metrics.CrashFreeSession,
	perceivedCrashFree *metrics.PerceivedCrashFreeSession,
	anrFree *metrics.ANRFreeSession,
	perceivedANRFree *metrics.PerceivedANRFreeSession,
	err error,
) {
	crashFree = &metrics.CrashFreeSession{}
	perceivedCrashFree = &metrics.PerceivedCrashFreeSession{}

	switch a.OSName {
	case opsys.Android:
		anrFree = &metrics.ANRFreeSession{}
		perceivedANRFree = &metrics.PerceivedANRFreeSession{}
	}

	selectedVersions, err := af.VersionPairs()
	if err != nil {
		return
	}

	stmt := sqlf.From("app_metrics").
		Select("uniqMergeIf(unique_sessions, app_version in (?)) as selected_sessions", selectedVersions.Parameterize()).
		Select("uniqMergeIf(unique_sessions, app_version not in (?)) as unselected_sessions", selectedVersions.Parameterize()).
		Select("uniqMergeIf(crash_sessions, app_version in (?)) as selected_crash_sessions", selectedVersions.Parameterize()).
		Select("uniqMergeIf(crash_sessions, app_version not in (?)) as unselected_crash_sessions", selectedVersions.Parameterize()).
		Select("uniqMergeIf(perceived_crash_sessions, app_version in (?)) as selected_perceived_crash_sessions", selectedVersions.Parameterize()).
		Select("uniqMergeIf(perceived_crash_sessions, app_version not in (?)) as unselected_perceived_crash_sessions", selectedVersions.Parameterize())

	switch a.OSName {
	case opsys.Android:
		stmt.
			Select("uniqMergeIf(anr_sessions, app_version in (?)) as selected_anr_sessions", selectedVersions.Parameterize()).
			Select("uniqMergeIf(anr_sessions, app_version not in (?)) as unselected_anr_sessions", selectedVersions.Parameterize()).
			Select("uniqMergeIf(perceived_anr_sessions, app_version in (?)) as selected_perceived_anr_sessions", selectedVersions.Parameterize()).
			Select("uniqMergeIf(perceived_anr_sessions, app_version not in (?)) as unselected_perceived_anr_sessions", selectedVersions.Parameterize())
	}

	stmt.
		Where("app_id = toUUID(?)", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer stmt.Close()

	var (
		selected, unselected                             uint64
		crashSelected, crashUnselected                   uint64
		perceivedCrashSelected, perceivedCrashUnselected uint64
		anrSelected, anrUnselected                       uint64
		perceivedANRSelected, perceivedANRUnselected     uint64
		crashFreeUnselected                              float64
		perceivedCrashFreeUnselected                     float64
		anrFreeUnselected                                float64
		perceivedANRFreeUnselected                       float64
	)

	dest := []any{
		&selected,
		&unselected,
		&crashSelected,
		&crashUnselected,
		&perceivedCrashSelected,
		&perceivedCrashUnselected,
	}

	switch a.OSName {
	case opsys.Android:
		dest = append(dest, &anrSelected, &anrUnselected, &perceivedANRSelected, &perceivedANRUnselected)
	}

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(dest...); err != nil {
		return
	}

	if selected == 0 {
		crashFree.CrashFreeSessions = math.NaN()
		perceivedCrashFree.CrashFreeSessions = math.NaN()

		switch a.OSName {
		case opsys.Android:
			anrFree.ANRFreeSessions = math.NaN()
			perceivedANRFree.ANRFreeSessions = math.NaN()
		}
	} else {
		crashFree.CrashFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(crashSelected) / float64(selected))) * 100)
		perceivedCrashFree.CrashFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedCrashSelected) / float64(selected))) * 100)

		switch a.OSName {
		case opsys.Android:
			anrFree.ANRFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(anrSelected) / float64(selected))) * 100)
			perceivedANRFree.ANRFreeSessions = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedANRSelected) / float64(selected))) * 100)
		}
	}

	if unselected == 0 {
		crashFreeUnselected = math.NaN()
		perceivedCrashFreeUnselected = math.NaN()

		switch a.OSName {
		case opsys.Android:
			anrFreeUnselected = math.NaN()
			perceivedANRFreeUnselected = math.NaN()
		}
	} else {
		crashFreeUnselected = numeric.RoundTwoDecimalsFloat64((1 - (float64(crashUnselected) / float64(unselected))) * 100)
		perceivedCrashFreeUnselected = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedCrashUnselected) / float64(unselected))) * 100)

		switch a.OSName {
		case opsys.Android:
			anrFreeUnselected = numeric.RoundTwoDecimalsFloat64((1 - (float64(anrUnselected) / float64(unselected))) * 100)
			perceivedANRFreeUnselected = numeric.RoundTwoDecimalsFloat64((1 - (float64(perceivedANRUnselected) / float64(unselected))) * 100)
		}
	}

	// compute delta
	if unselectedVersions.HasVersions() {
		// avoid division by zero
		if crashFreeUnselected != 0 {
			// Round to two decimal places
			crashFree.Delta = numeric.RoundTwoDecimalsFloat64(crashFree.CrashFreeSessions / crashFreeUnselected)
		} else {
			crashFree.Delta = 1
		}

		if perceivedCrashFreeUnselected != 0 {
			crashFree.Delta = numeric.RoundTwoDecimalsFloat64(perceivedCrashFree.CrashFreeSessions / perceivedCrashFreeUnselected)
		} else {
			perceivedCrashFree.Delta = 1
		}

		switch a.OSName {
		case opsys.Android:
			if anrFreeUnselected != 0 {
				anrFree.Delta = numeric.RoundTwoDecimalsFloat64(anrFree.ANRFreeSessions / anrFreeUnselected)
			} else {
				anrFree.Delta = 1
			}

			if perceivedANRFreeUnselected != 0 {
				perceivedANRFree.Delta = numeric.RoundTwoDecimalsFloat64(perceivedANRFree.ANRFreeSessions / perceivedANRFreeUnselected)
			} else {
				perceivedANRFree.Delta = 1
			}
		}

	} else {
		// because if there are no unselected
		// app versions, then:
		// crash free sessions of unselected app versions = crash free sessions of selected app versions
		// ratio between the two, will be always 1
		if crashFree.CrashFreeSessions != 0 {
			crashFree.Delta = 1
		}

		if perceivedCrashFree.CrashFreeSessions != 0 {
			perceivedCrashFree.Delta = 1
		}

		switch a.OSName {
		case opsys.Android:
			if anrFree.ANRFreeSessions != 0 {
				anrFree.Delta = 1
			}

			if perceivedANRFree.ANRFreeSessions != 0 {
				perceivedANRFree.Delta = 1
			}
		}
	}

	crashFree.SetNaNs()
	perceivedCrashFree.SetNaNs()

	switch a.OSName {
	case opsys.Android:
		anrFree.SetNaNs()
		perceivedANRFree.SetNaNs()
	}

	return
}

// GetAdoptionMetrics computes adoption by computing sessions
// for selected versions and sessions of all versions for an app.
func (a App) GetAdoptionMetrics(ctx context.Context, af *filter.AppFilter) (adoption *metrics.SessionAdoption, err error) {
	adoption = &metrics.SessionAdoption{}
	selectedVersions, err := af.VersionPairs()
	if err != nil {
		return
	}

	stmt := sqlf.From("app_metrics").
		Select("uniqMergeIf(unique_sessions, app_version in (?)) as selected_sessions", selectedVersions.Parameterize()).
		Select("uniqMerge(unique_sessions) as all_sessions").
		Select("round((selected_sessions / all_sessions) * 100, 2) as adoption").
		Where("app_id = toUUID(?)", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer stmt.Close()

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&adoption.SelectedVersion, &adoption.AllVersions, &adoption.Adoption); err != nil {
		return
	}

	adoption.SetNaNs()

	return
}

// GetLaunchMetrics computes cold, warm and hot launch quantiles
// and deltas while respecting all applicable app filters.
// Deltas are computed between launch metric values of selected and
// unselected app versions.
func (a App) GetLaunchMetrics(ctx context.Context, af *filter.AppFilter) (launch *metrics.LaunchMetric, err error) {
	launch = &metrics.LaunchMetric{}

	selectedVersions, err := af.VersionPairs()

	withStmt := sqlf.From("app_metrics").
		Select("quantileMergeIf(0.95)(cold_launch_p95, app_version not in (?)) as cold_launch_p95", selectedVersions.Parameterize()).
		Select("quantileMergeIf(0.95)(warm_launch_p95, app_version not in (?)) as warm_launch_p95", selectedVersions.Parameterize()).
		Select("quantileMergeIf(0.95)(hot_launch_p95, app_version not in (?)) as hot_launch_p95", selectedVersions.Parameterize()).
		Where("app_id = toUUID(?)", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer withStmt.Close()

	stmt := sqlf.New(fmt.Sprintf("with (%s) as unselected select", withStmt.String()), withStmt.Args()...).
		Select("round(quantileMergeIf(0.95)(cold_launch_p95, app_version in (?)), 2) as selected_cold_launch_p95", selectedVersions.Parameterize()).
		Select("round(quantileMergeIf(0.95)(warm_launch_p95, app_version in (?)), 2) as selected_warm_launch_p95", selectedVersions.Parameterize()).
		Select("round(quantileMergeIf(0.95)(hot_launch_p95, app_version in (?)), 2) as selected_hot_launch_p95", selectedVersions.Parameterize()).
		Select("round((selected_cold_launch_p95 / unselected.cold_launch_p95), 2) as cold_delta").
		Select("round((selected_warm_launch_p95 / unselected.warm_launch_p95), 2) as warm_delta").
		Select("round((selected_hot_launch_p95 / unselected.hot_launch_p95), 2) as hot_delta").
		From("app_metrics").
		Where("app_id = toUUID(?)", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer stmt.Close()

	if err = server.Server.ChPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(
		&launch.ColdLaunchP95,
		&launch.WarmLaunchP95,
		&launch.HotLaunchP95,
		&launch.ColdDelta,
		&launch.WarmDelta,
		&launch.HotDelta,
	); err != nil {
		return
	}

	launch.SetNaNs()

	return
}

// getJourneyEvents queries all relevant lifecycle
// and issue events involved in forming
// an implicit navigational journey.
func (a App) getJourneyEvents(ctx context.Context, af *filter.AppFilter, opts filter.JourneyOpts) (events []event.EventField, err error) {
	whereVals := []any{}

	switch opsys.ToFamily(a.OSName) {
	case opsys.Android:
		whereVals = append(
			whereVals,
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
		)
	case opsys.AppleFamily:
		whereVals = append(
			whereVals,
			event.TypeLifecycleViewController,
			[]string{
				event.LifecycleViewControllerTypeViewDidLoad,
				event.LifecycleViewControllerTypeViewDidAppear,
			},
			event.TypeLifecycleSwiftUI,
			[]string{
				event.LifecycleSwiftUITypeOnAppear,
			},
		)
	}

	if opts.All {
		switch opsys.ToFamily(a.OSName) {
		case opsys.Android:
			whereVals = append(whereVals, event.TypeException, false, event.TypeANR)
		case opsys.AppleFamily:
			whereVals = append(whereVals, event.TypeException, false)
		}
	} else if opts.Exceptions {
		whereVals = append(whereVals, event.TypeException, false)
	} else if opts.ANRs {
		switch a.OSName {
		case opsys.Android:
			whereVals = append(whereVals, event.TypeANR)
		}
	}

	stmt := sqlf.
		From(`events`).
		Select(`distinct id`).
		Select(`toString(type)`).
		Select(`timestamp`).
		Select(`session_id`).
		Where(`app_id = toUUID(?)`, a.ID).
		Where("`timestamp` >= ? and `timestamp` <= ?", af.From, af.To)

	switch opsys.ToFamily(a.OSName) {
	case opsys.Android:
		stmt.
			Select(`toString(lifecycle_activity.type)`).
			Select(`toString(lifecycle_activity.class_name)`).
			Select(`toString(lifecycle_fragment.type)`).
			Select(`toString(lifecycle_fragment.class_name)`).
			Select(`toString(lifecycle_fragment.parent_activity)`).
			Select(`toString(lifecycle_fragment.parent_fragment)`)
	case opsys.AppleFamily:
		stmt.
			Select(`toString(lifecycle_view_controller.type)`).
			Select(`toString(lifecycle_view_controller.class_name)`).
			Select(`toString(lifecycle_swift_ui.type)`).
			Select(`toString(lifecycle_swift_ui.class_name)`)
	}

	if len(af.Versions) > 0 {
		stmt.Where("`attribute.app_version` in ?", af.Versions)
	}

	if len(af.VersionCodes) > 0 {
		stmt.Where("`attribute.app_build` in ?", af.VersionCodes)
	}

	if opts.All {
		switch opsys.ToFamily(a.OSName) {
		case opsys.Android:
			stmt.Where("((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` in ?) or ((type = ? and `exception.handled` = ?) or type = ?))", whereVals...)
		case opsys.AppleFamily:
			stmt.Where("((type = ? and `lifecycle_view_controller.type` in ?) or (type = ? and `lifecycle_swift_ui.type` in ?) or (type = ? and `exception.handled` = ?))", whereVals...)
		}
	} else if opts.Exceptions {
		stmt.Where("((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` in ?) or (type = ? and `exception.handled` = ?))", whereVals...)
	} else if opts.ANRs {
		switch a.OSName {
		case opsys.Android:
			stmt.Where("((type = ? and `lifecycle_activity.type` in ?) or (type = ? and `lifecycle_fragment.type` in ?) or (type = ?))", whereVals...)
		}
	}

	if len(af.OsNames) > 0 {
		stmt.Where("`attribute.os_name` in ?", af.OsNames)
	}

	if len(af.OsVersions) > 0 {
		stmt.Where("`attribute.os_version` in ?", af.OsVersions)
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
		var lifecycleViewControllerType string
		var lifecycleViewControllerClassName string
		var lifecycleSwiftUIType string
		var lifecycleSwiftUIClassName string

		dest := []any{
			&ev.ID,
			&ev.Type,
			&ev.Timestamp,
			&ev.SessionID,
		}

		switch opsys.ToFamily(a.OSName) {
		case opsys.Android:
			dest = append(
				dest,
				&lifecycleActivityType,
				&lifecycleActivityClassName,
				&lifecycleFragmentType,
				&lifecycleFragmentClassName,
				&lifecycleFragmentParentActivity,
				&lifecycleFragmentParentFragment,
			)
		case opsys.AppleFamily:
			dest = append(
				dest,
				&lifecycleViewControllerType,
				&lifecycleViewControllerClassName,
				&lifecycleSwiftUIType,
				&lifecycleSwiftUIClassName,
			)
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
		} else if ev.IsLifecycleViewController() {
			ev.LifecycleViewController = &event.LifecycleViewController{
				Type:      lifecycleViewControllerType,
				ClassName: lifecycleViewControllerClassName,
			}
		} else if ev.IsLifecycleSwiftUI() {
			ev.LifecycleSwiftUI = &event.LifecycleSwiftUI{
				Type:      lifecycleSwiftUIType,
				ClassName: lifecycleSwiftUIClassName,
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

	_, err = tx.Exec(context.Background(), "insert into apps(id, team_id, app_name, created_at, updated_at) values ($1, $2, $3, $4, $5);", a.ID, a.TeamId, a.AppName, a.CreatedAt, a.UpdatedAt)

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
	var osName pgtype.Text
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
		"apps.os_name",
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
		From("apps").
		LeftJoin("api_keys", "api_keys.app_id = apps.id").
		Where("apps.id = ? and apps.team_id = ?", nil, nil)

	defer stmt.Close()

	dest := []any{
		&appName,
		&uniqueId,
		&osName,
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

	if osName.Valid {
		a.OSName = osName.String
	} else {
		a.OSName = ""
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
		Where("id = ?", a.ID)

	defer stmt.Close()

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&team.ID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		} else {
			return nil, err
		}
	}

	return team, nil
}

// Populate fills in all app values
// for the app.
func (a *App) Populate(ctx context.Context) (err error) {
	stmt := sqlf.PostgreSQL.From("apps").
		Select("team_id::UUID").
		Select("unique_identifier").
		Select("app_name").
		Select("os_name").
		Select("first_version").
		Select("onboarded").
		Select("onboarded_at").
		Select("created_at").
		Select("updated_at").
		Where("id = ?", a.ID)

	defer stmt.Close()

	return server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&a.TeamId, &a.UniqueId, &a.AppName, &a.OSName, &a.FirstVersion, &a.Onboarded, &a.OnboardedAt, &a.CreatedAt, &a.UpdatedAt)
}

func (a *App) Onboard(ctx context.Context, tx *pgx.Tx, uniqueIdentifier, osName, firstVersion string) error {
	now := time.Now()
	stmt := sqlf.PostgreSQL.Update("apps").
		Set("onboarded", true).
		Set("unique_identifier", uniqueIdentifier).
		Set("os_name", osName).
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
		`user_defined_attribute`,
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
		`exception.handled`,
		`exception.fingerprint`,
		`exception.foreground`,
		`exception.exceptions`,
		`exception.threads`,
		`toString(exception.framework)`,
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
		`warm_launch.process_start_uptime`,
		`warm_launch.process_start_requested_uptime`,
		`warm_launch.content_provider_attach_uptime`,
		`warm_launch.on_next_draw_uptime`,
		`toString(warm_launch.launched_activity)`,
		`warm_launch.has_saved_state`,
		`warm_launch.intent_data`,
		`warm_launch.duration`,
		`warm_launch.is_lukewarm`,
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
		`toString(screen_view.name) `,
		`bug_report.description`,
		`custom.name`,
	}

	switch opsys.ToFamily(a.OSName) {
	case opsys.Android:
		cols = append(cols, []string{
			`anr.fingerprint`,
			`anr.foreground`,
			`anr.exceptions`,
			`anr.threads`,
			`toString(app_exit.reason)`,
			`toString(app_exit.importance)`,
			`app_exit.trace`,
			`app_exit.process_name`,
			`app_exit.pid`,
			`toString(string.severity_text)`,
			`string.string`,
			`toString(lifecycle_activity.type)`,
			`toString(lifecycle_activity.class_name)`,
			`lifecycle_activity.intent`,
			`lifecycle_activity.saved_instance_state`,
			`toString(lifecycle_fragment.type)`,
			`toString(lifecycle_fragment.class_name)`,
			`lifecycle_fragment.parent_activity`,
			`lifecycle_fragment.parent_fragment`,
			`lifecycle_fragment.tag`,
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
			`toString(navigation.to)`,
			`toString(navigation.from)`,
			`toString(navigation.source)`,
		}...)
	case opsys.AppleFamily:
		cols = append(cols, []string{
			`exception.error`,
			`toString(lifecycle_view_controller.type)`,
			`toString(lifecycle_view_controller.class_name)`,
			`toString(lifecycle_swift_ui.type)`,
			`toString(lifecycle_swift_ui.class_name)`,
			`memory_usage_absolute.max_memory`,
			`memory_usage_absolute.used_memory`,
			`memory_usage_absolute.interval`,
		}...)
	}

	stmt := sqlf.From("events")
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
		var screenView event.ScreenView
		var userDefAttr map[string][]any
		var bugReport event.BugReport
		var custom event.Custom

		var coldLaunchDuration uint32
		var warmLaunchDuration uint32
		var hotLaunchDuration uint32

		var exceptionError string
		var lifecycleViewController event.LifecycleViewController
		var lifecycleSwiftUI event.LifecycleSwiftUI
		var memoryUsageAbs event.MemoryUsageAbs

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

			// user defined attributes
			&userDefAttr,

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

			// excpetion
			&exception.Handled,
			&exception.Fingerprint,
			&exception.Foreground,
			&exceptionExceptions,
			&exceptionThreads,
			&exception.Framework,

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
			&warmLaunch.ProcessStartUptime,
			&warmLaunch.ProcessStartRequestedUptime,
			&warmLaunch.ContentProviderAttachUptime,
			&warmLaunch.OnNextDrawUptime,
			&warmLaunch.LaunchedActivity,
			&warmLaunch.HasSavedState,
			&warmLaunch.IntentData,
			&warmLaunchDuration,
			&warmLaunch.IsLukewarm,

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

			// screen view
			&screenView.Name,

			// bug report
			&bugReport.Description,

			// custom
			&custom.Name,
		}

		switch opsys.ToFamily(a.OSName) {
		case opsys.Android:
			dest = append(dest, []any{
				// anr
				&anr.Fingerprint,
				&anr.Foreground,
				&anrExceptions,
				&anrThreads,

				// app exit
				&appExit.Reason,
				&appExit.Importance,
				&appExit.Trace,
				&appExit.ProcessName,
				&appExit.PID,

				// log string
				&logString.SeverityText,
				&logString.String,

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

				// navigation
				&navigation.To,
				&navigation.From,
				&navigation.Source,
			}...)
		case opsys.AppleFamily:
			dest = append(dest, []any{
				&exceptionError,
				&lifecycleViewController.Type,
				&lifecycleViewController.ClassName,
				&lifecycleSwiftUI.Type,
				&lifecycleSwiftUI.ClassName,
				&memoryUsageAbs.MaxMemory,
				&memoryUsageAbs.UsedMemory,
				&memoryUsageAbs.Interval,
			}...)
		}

		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}

		// populate user defined attribute
		if len(userDefAttr) > 0 {
			ev.UserDefinedAttribute.Scan(userDefAttr)
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

			// for now, only unmarshal exception.error for Apple
			// family of OSes. support can - of course, be extended
			// to other OSes on a "need to" basis.
			switch opsys.ToFamily(a.OSName) {
			case opsys.AppleFamily:
				fmt.Println("exceptionError", exceptionError)
				if exceptionError != "" {
					if err := json.Unmarshal([]byte(exceptionError), &exception.Error); err != nil {
						return nil, err
					}
				}
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
			// only unmarshal attachments if more than
			// 8 characters
			if len(attachments) > 8 {
				if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
					return nil, err
				}
			}
			ev.GestureLongClick = &gestureLongClick
			session.Events = append(session.Events, ev)
		case event.TypeGestureClick:
			// only unmarshal attachments if more than
			// 8 characters
			if len(attachments) > 8 {
				if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
					return nil, err
				}
			}
			if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
				return nil, err
			}
			ev.GestureClick = &gestureClick
			session.Events = append(session.Events, ev)
		case event.TypeGestureScroll:
			// only unmarshal attachments if more than
			// 8 characters
			if len(attachments) > 8 {
				if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
					return nil, err
				}
			}
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
		case event.TypeScreenView:
			ev.ScreenView = &screenView
			session.Events = append(session.Events, ev)
		case event.TypeBugReport:
			if err := json.Unmarshal([]byte(attachments), &ev.Attachments); err != nil {
				return nil, err
			}
			ev.BugReport = &bugReport
			session.Events = append(session.Events, ev)
		case event.TypeCustom:
			ev.Custom = &custom
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleViewController:
			ev.LifecycleViewController = &lifecycleViewController
			session.Events = append(session.Events, ev)
		case event.TypeLifecycleSwiftUI:
			ev.LifecycleSwiftUI = &lifecycleSwiftUI
			session.Events = append(session.Events, ev)
		case event.TypeMemoryUsageAbs:
			ev.MemoryUsageAbs = &memoryUsageAbs
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
	var os pgtype.Text
	var firstVersion pgtype.Text

	stmt := sqlf.PostgreSQL.
		Select("id").
		Select("onboarded").
		Select("unique_identifier").
		Select("os_name").
		Select("first_version").
		From("apps").
		Where("id = ?", id)

	defer stmt.Close()

	if app == nil {
		app = &App{}
	}

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&app.ID, &onboarded, &uniqueId, &os, &firstVersion); err != nil {
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

	if os.Valid {
		app.OSName = os.String
	} else {
		app.OSName = ""
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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

	if err := app.Populate(ctx); err != nil {
		msg := `failed to fetch app details`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
			msg = fmt.Sprintf(`app with id %q does not exist`, app.ID)
		}

		c.JSON(status, gin.H{
			"error": msg,
		})

		return
	}

	team := &Team{
		ID: &app.TeamId,
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
		if app.OSName == opsys.Android && journeyEvents[i].IsANR() {
			issueEvents = append(issueEvents, journeyEvents[i])
		}
	}

	var journeyGraph journey.Journey
	type Link struct {
		Source string `json:"source"`
		Target string `json:"target"`
		Value  int    `json:"value"`
	}

	type Issue struct {
		ID    string `json:"id"`
		Title string `json:"title"`
		Count int    `json:"count"`
	}

	type Node struct {
		ID     string `json:"id"`
		Issues gin.H  `json:"issues"`
	}

	var nodes []Node
	var links []Link

	switch opsys.ToFamily(app.OSName) {
	case opsys.Android:
		journeyGraph = journey.NewJourneyAndroid(journeyEvents, &journey.Options{
			BiGraph: af.BiGraph,
		})
	case opsys.AppleFamily:
		journeyGraph = journey.NewJourneyiOS(journeyEvents, &journey.Options{
			BiGraph: af.BiGraph,
		})
	}

	switch j := journeyGraph.(type) {
	case *journey.JourneyAndroid:
		if err := j.SetNodeExceptionGroups(func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error) {
			// do not hit database if no event ids
			// to query
			if len(eventIds) == 0 {
				return
			}

			exceptionGroups, err = group.GetExceptionGroupsFromExceptionIds(ctx, &af, eventIds)
			if err != nil {
				return
			}

			return
		}); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		if err := j.SetNodeANRGroups(func(eventIds []uuid.UUID) (anrGroups []group.ANRGroup, err error) {
			// do not hit database if no event ids
			// to query
			if len(eventIds) == 0 {
				return
			}

			anrGroups, err = group.GetANRGroupsFromANRIds(ctx, &af, eventIds)
			if err != nil {
				return
			}

			return
		}); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		for v := range j.Graph.Order() {
			j.Graph.Visit(v, func(w int, c int64) bool {
				var link Link
				link.Source = j.GetNodeName(v)
				link.Target = j.GetNodeName(w)
				link.Value = j.GetEdgeSessionCount(v, w)
				links = append(links, link)
				return false
			})
		}

		for _, v := range j.GetNodeVertices() {
			var node Node
			name := j.GetNodeName(v)
			exceptionGroups := j.GetNodeExceptionGroups(name)
			crashes := []Issue{}

			for i := range exceptionGroups {
				issue := Issue{
					ID:    exceptionGroups[i].ID,
					Title: exceptionGroups[i].GetDisplayTitle(),
					Count: j.GetNodeExceptionCount(v, exceptionGroups[i].ID),
				}
				crashes = append(crashes, issue)
			}

			// crashes are shown in descending order
			sort.Slice(crashes, func(i, j int) bool {
				return crashes[i].Count > crashes[j].Count
			})

			anrGroups := j.GetNodeANRGroups(name)
			anrs := []Issue{}

			for i := range anrGroups {
				issue := Issue{
					ID:    anrGroups[i].ID,
					Title: anrGroups[i].GetDisplayTitle(),
					Count: j.GetNodeANRCount(v, anrGroups[i].ID),
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
	case *journey.JourneyiOS:
		if err := j.SetNodeExceptionGroups(func(eventIds []uuid.UUID) (exceptionGroups []group.ExceptionGroup, err error) {
			// do not hit database if no event ids
			// to query
			if len(eventIds) == 0 {
				return
			}

			exceptionGroups, err = group.GetExceptionGroupsFromExceptionIds(ctx, &af, eventIds)
			if err != nil {
				return
			}

			return
		}); err != nil {
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		for v := range j.Graph.Order() {
			j.Graph.Visit(v, func(w int, c int64) bool {
				var link Link
				link.Source = j.GetNodeName(v)
				link.Target = j.GetNodeName(w)
				link.Value = j.GetEdgeSessionCount(v, w)
				links = append(links, link)
				return false
			})
		}

		for _, v := range j.GetNodeVertices() {
			var node Node
			name := j.GetNodeName(v)
			exceptionGroups := j.GetNodeExceptionGroups(name)
			crashes := []Issue{}

			for i := range exceptionGroups {
				issue := Issue{
					ID:    exceptionGroups[i].ID,
					Title: exceptionGroups[i].GetDisplayTitle(),
					Count: j.GetNodeExceptionCount(v, exceptionGroups[i].ID),
				}
				crashes = append(crashes, issue)
			}

			// crashes are shown in descending order
			sort.Slice(crashes, func(i, j int) bool {
				return crashes[i].Count > crashes[j].Count
			})

			node.ID = name
			node.Issues = gin.H{
				"crashes": crashes,
				"anrs":    []Issue{},
			}
			nodes = append(nodes, node)
		}
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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

	if err := app.Populate(ctx); err != nil {
		msg := `failed to fetch app details`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
			msg = fmt.Sprintf(`app with id %q does not exist`, app.ID)
		}

		c.JSON(status, gin.H{
			"error": msg,
		})

		return
	}

	af.AppOSName = app.OSName

	team := &Team{
		ID: &app.TeamId,
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

	excludedVersions, err := af.GetExcludedVersions(ctx)
	if err != nil {
		msg := `failed to fetch excluded versions`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	adoption, err := app.GetAdoptionMetrics(ctx, &af)
	if err != nil {
		msg := `failed to fetch adoption metrics`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	crashFree, perceivedCrashFree, anrFree, perceivedANRFree, err := app.GetIssueFreeMetrics(ctx, &af, excludedVersions)
	if err != nil {
		msg := `failed to fetch issue free metrics`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	launch, err := app.GetLaunchMetrics(ctx, &af)
	if err != nil {
		msg := `failed to fetch launch metrics`
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
			msg := `failed to fetch size metrics`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
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
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
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
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := af.Validate(); err != nil {
		msg := "app filters request validation failed"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	app, err := SelectApp(ctx, id)
	if err != nil {
		msg := "failed to select app"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	af.AppOSName = app.OSName

	team, err := app.getTeam(ctx)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	var fl filter.FilterList

	if err := af.GetGenericFilters(ctx, &fl); err != nil {
		msg := `failed to query app filters`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	// club version names & version codes
	var versions []any
	for i := range fl.Versions {
		version := gin.H{"name": fl.Versions[i], "code": fl.VersionCodes[i]}
		versions = append(versions, version)
	}

	// club os names & versions
	var osVersions []any
	for i := range fl.OsVersions {
		osVersion := gin.H{"name": fl.OsNames[i], "version": fl.OsVersions[i]}
		osVersions = append(osVersions, osVersion)
	}

	udAttrs := gin.H{
		"operator_types": nil,
		"key_types":      nil,
	}

	if af.UDAttrKeys {
		if err := af.GetUserDefinedAttrKeys(ctx, &fl); err != nil {
			msg := `failed to query user defined attribute keys`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}
		udAttrs["operator_types"] = event.GetUDAttrsOpMap()
		udAttrs["key_types"] = fl.UDKeyTypes
	}

	c.JSON(http.StatusOK, gin.H{
		"versions":             versions,
		"os_versions":          osVersions,
		"countries":            fl.Countries,
		"network_providers":    fl.NetworkProviders,
		"network_types":        fl.NetworkTypes,
		"network_generations":  fl.NetworkGenerations,
		"locales":              fl.DeviceLocales,
		"device_manufacturers": fl.DeviceManufacturers,
		"device_names":         fl.DeviceNames,
		"ud_attrs":             udAttrs,
	})
}

func GetCrashOverview(c *gin.Context) {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "crash overview request validation failed"
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
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	userId := c.GetString("userId")
	okTeam, err := PerformAuthz(userId, team.ID.String(), *ScopeTeamRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	okApp, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `failed to perform authorization`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if !okTeam || !okApp {
		msg := `you are not authorized to access this app`
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	groups, err := app.GetExceptionGroupsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's exception groups with filter"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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
			instances = append(instances, instance)
			lut[crashInstances[i].Version] = len(instances) - 1
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

	crashGroupId := c.Param("crashGroupId")
	if crashGroupId == "" {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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
		msg := fmt.Sprintf("failed to get exception group with id %q", crashGroupId)
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

	eventExceptions, next, previous, err := GetExceptionsWithFilter(ctx, group, &af)
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
				if err := eventExceptions[i].Attachments[j].PreSignURL(ctx); err != nil {
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

	crashGroupId := c.Param("crashGroupId")
	if crashGroupId == "" {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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
		msg := fmt.Sprintf("failed to get exception group with id %q", crashGroupId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	crashInstances, err := GetIssuesPlot(ctx, group, &af)
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
			instances = append(instances, instance)
			lut[crashInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetCrashDetailAttributeDistribution(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	crashGroupId := c.Param("crashGroupId")
	if crashGroupId == "" {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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
		msg := fmt.Sprintf("failed to get exception group with id %q", crashGroupId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	distribution, err := GetIssuesAttributeDistribution(ctx, group, &af)
	if err != nil {
		msg := `failed to query data for crash distribution plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, distribution)
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

	crashGroupId := c.Param("crashGroupId")
	if crashGroupId == "" {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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
		msg := fmt.Sprintf("failed to get exception group with id %q", crashGroupId)
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
		ID    string `json:"id"`
		Title string `json:"title"`
		Count int    `json:"count"`
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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
			instances = append(instances, instance)
			lut[anrInstances[i].Version] = len(instances) - 1
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

	anrGroupId := c.Param("anrGroupId")
	if anrGroupId == "" {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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
		msg := fmt.Sprintf("failed to get ANR group with id %q", anrGroupId)
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

	eventANRs, next, previous, err := GetANRsWithFilter(ctx, group, &af)
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
				if err := eventANRs[i].Attachments[j].PreSignURL(ctx); err != nil {
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

	anrGroupId := c.Param("anrGroupId")
	if anrGroupId == "" {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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
		msg := fmt.Sprintf("failed to get ANR group with id %q", anrGroupId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	anrInstances, err := GetIssuesPlot(ctx, group, &af)
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
			instances = append(instances, instance)
			lut[anrInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetANRDetailAttributeDistribution(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	anrGroupId := c.Param("anrGroupId")
	if anrGroupId == "" {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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
		msg := fmt.Sprintf("failed to get anr group with id %q", anrGroupId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	distribution, err := GetIssuesAttributeDistribution(ctx, group, &af)
	if err != nil {
		msg := `failed to query data for anr distribution plot`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, distribution)
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

	anrGroupId := c.Param("anrGroupId")
	if anrGroupId == "" {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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
		msg := fmt.Sprintf("failed to get ANR group with id %q", anrGroupId)
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
		ID    string `json:"id"`
		Title string `json:"title"`
		Count int    `json:"count"`
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

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

	sessions, next, previous, err := GetSessionsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's sessions"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": sessions,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetSessionsOverviewPlotInstances(c *gin.Context) {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `sessions overview request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if !af.HasTimezone() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing required field `timezone`",
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

	sessionInstances, err := GetSessionsInstancesPlot(ctx, &af)
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
			instances = append(instances, instance)
			lut[sessionInstances[i].Version] = len(instances) - 1
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

	if err := app.Populate(ctx); err != nil {
		msg := `failed to fetch app details`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError

		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
			msg = fmt.Sprintf(`app with id %q does not exist`, app.ID)
		}

		c.JSON(status, gin.H{
			"error": msg,
		})

		return
	}

	team := &Team{
		ID: &app.TeamId,
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
		msg := `failed to fetch session data for timeline`
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
			if err := session.Events[i].Attachments[j].PreSignURL(ctx); err != nil {
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
	cpuUsages := timeline.ComputeCPUUsage(cpuUsageEvents)

	memoryUsageEvents := session.EventsOfType(event.TypeMemoryUsage)
	memoryUsages := timeline.ComputeMemoryUsage(memoryUsageEvents)

	memoryUsageAbsEvents := session.EventsOfType(event.TypeMemoryUsageAbs)
	memoryUsageAbsolutes := timeline.ComputeMemoryUsageAbs(memoryUsageAbsEvents)

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
		event.TypeLifecycleViewController,
		event.TypeLifecycleSwiftUI,
		event.TypeLifecycleApp,
		event.TypeTrimMemory,
		event.TypeLowMemory,
		event.TypeAppExit,
		event.TypeException,
		event.TypeANR,
		event.TypeHttp,
		event.TypeScreenView,
		event.TypeBugReport,
		event.TypeCustom,
	}

	eventMap := session.EventsOfTypes(typeList...)
	threads := make(timeline.Threads)

	gestureClickEvents := eventMap[event.TypeGestureClick]
	if len(gestureClickEvents) > 0 {
		gestureClicks := timeline.ComputeGestureClicks(gestureClickEvents)
		threadedGestureClicks := timeline.GroupByThreads(gestureClicks)
		threads.Organize(event.TypeGestureClick, threadedGestureClicks)
	}

	gestureLongClickEvents := eventMap[event.TypeGestureLongClick]
	if len(gestureLongClickEvents) > 0 {
		gestureLongClicks := timeline.ComputeGestureLongClicks(gestureLongClickEvents)
		threadedGestureLongClicks := timeline.GroupByThreads(gestureLongClicks)
		threads.Organize(event.TypeGestureLongClick, threadedGestureLongClicks)
	}

	gestureScrollEvents := eventMap[event.TypeGestureScroll]
	if len(gestureScrollEvents) > 0 {
		gestureScrolls := timeline.ComputeGestureScrolls(gestureScrollEvents)
		threadedGestureScrolls := timeline.GroupByThreads(gestureScrolls)
		threads.Organize(event.TypeGestureScroll, threadedGestureScrolls)
	}

	navEvents := eventMap[event.TypeNavigation]
	if len(navEvents) > 0 {
		navs := timeline.ComputeNavigation(navEvents)
		threadedNavs := timeline.GroupByThreads(navs)
		threads.Organize(event.TypeNavigation, threadedNavs)
	}

	screenViewEvents := eventMap[event.TypeScreenView]
	if len(screenViewEvents) > 0 {
		screenViews := timeline.ComputeScreenViews(screenViewEvents)
		threadedScreenViews := timeline.GroupByThreads(screenViews)
		threads.Organize(event.TypeScreenView, threadedScreenViews)
	}

	bugReportEvents := eventMap[event.TypeBugReport]
	if len(bugReportEvents) > 0 {
		bugReports := timeline.ComputeBugReport(bugReportEvents)
		threadedBugReports := timeline.GroupByThreads(bugReports)
		threads.Organize(event.TypeBugReport, threadedBugReports)
	}

	customEvents := eventMap[event.TypeCustom]
	if len(customEvents) > 0 {
		customs := timeline.ComputeCustom(customEvents)
		threadedCustoms := timeline.GroupByThreads(customs)
		threads.Organize(event.TypeCustom, threadedCustoms)
	}

	logEvents := eventMap[event.TypeString]
	if len(logEvents) > 0 {
		logs := timeline.ComputeLogString(logEvents)
		threadedLogs := timeline.GroupByThreads(logs)
		threads.Organize(event.TypeString, threadedLogs)
	}

	netChangeEvents := eventMap[event.TypeNetworkChange]
	if len(netChangeEvents) > 0 {
		netChanges := timeline.ComputeNetworkChange(netChangeEvents)
		threadedNetChanges := timeline.GroupByThreads(netChanges)
		threads.Organize(event.TypeNetworkChange, threadedNetChanges)
	}

	coldLaunchEvents := eventMap[event.TypeColdLaunch]
	if len(coldLaunchEvents) > 0 {
		coldLaunches := timeline.ComputeColdLaunches(coldLaunchEvents)
		threadedColdLaunches := timeline.GroupByThreads(coldLaunches)
		threads.Organize(event.TypeColdLaunch, threadedColdLaunches)
	}

	warmLaunchEvents := eventMap[event.TypeWarmLaunch]
	if len(warmLaunchEvents) > 0 {
		warmLaunches := timeline.ComputeWarmLaunches(warmLaunchEvents)
		threadedWarmLaunches := timeline.GroupByThreads(warmLaunches)
		threads.Organize(event.TypeWarmLaunch, threadedWarmLaunches)
	}

	hotLaunchEvents := eventMap[event.TypeHotLaunch]
	if len(hotLaunchEvents) > 0 {
		hotLaunches := timeline.ComputeHotLaunches(hotLaunchEvents)
		threadedHotLaunches := timeline.GroupByThreads(hotLaunches)
		threads.Organize(event.TypeHotLaunch, threadedHotLaunches)
	}

	lifecycleActivityEvents := eventMap[event.TypeLifecycleActivity]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleActivities := timeline.ComputeLifecycleActivities(lifecycleActivityEvents)
		threadedLifecycleActivities := timeline.GroupByThreads(lifecycleActivities)
		threads.Organize(event.TypeLifecycleActivity, threadedLifecycleActivities)
	}

	lifecycleFragmentEvents := eventMap[event.TypeLifecycleFragment]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleFragments := timeline.ComputeLifecycleFragments(lifecycleFragmentEvents)
		threadedLifecycleFragments := timeline.GroupByThreads(lifecycleFragments)
		threads.Organize(event.TypeLifecycleFragment, threadedLifecycleFragments)
	}

	lifecycleViewControllerEvents := eventMap[event.TypeLifecycleViewController]
	if len(lifecycleViewControllerEvents) > 0 {
		lifecycleViewControllers := timeline.ComputeLifecycleViewControllers(lifecycleViewControllerEvents)
		threadedLifecycleViewControllers := timeline.GroupByThreads(lifecycleViewControllers)
		threads.Organize(event.TypeLifecycleViewController, threadedLifecycleViewControllers)
	}

	lifecycleSwiftUIEvents := eventMap[event.TypeLifecycleSwiftUI]
	if len(lifecycleSwiftUIEvents) > 0 {
		lifecycleSwiftUIViews := timeline.ComputeLifecycleSwiftUIViews(lifecycleSwiftUIEvents)
		threadedLifecycleSwiftUIViews := timeline.GroupByThreads(lifecycleSwiftUIViews)
		threads.Organize(event.TypeLifecycleSwiftUI, threadedLifecycleSwiftUIViews)
	}

	lifecycleAppEvents := eventMap[event.TypeLifecycleApp]
	if len(lifecycleActivityEvents) > 0 {
		lifecycleApps := timeline.ComputeLifecycleApps(lifecycleAppEvents)
		threadedLifecycleApps := timeline.GroupByThreads(lifecycleApps)
		threads.Organize(event.TypeLifecycleApp, threadedLifecycleApps)
	}

	trimMemoryEvents := eventMap[event.TypeTrimMemory]
	if len(trimMemoryEvents) > 0 {
		trimMemories := timeline.ComputeTrimMemories(trimMemoryEvents)
		threadedTrimMemories := timeline.GroupByThreads(trimMemories)
		threads.Organize(event.TypeTrimMemory, threadedTrimMemories)
	}

	lowMemoryEvents := eventMap[event.TypeLowMemory]
	if len(lowMemoryEvents) > 0 {
		lowMemories := timeline.ComputeLowMemories(lowMemoryEvents)
		threadedLowMemories := timeline.GroupByThreads(lowMemories)
		threads.Organize(event.TypeLowMemory, threadedLowMemories)
	}

	appExitEvents := eventMap[event.TypeAppExit]
	if len(appExitEvents) > 0 {
		appExits := timeline.ComputeAppExits(appExitEvents)
		threadedAppExits := timeline.GroupByThreads(appExits)
		threads.Organize(event.TypeAppExit, threadedAppExits)
	}

	exceptionEvents := eventMap[event.TypeException]
	if len(exceptionEvents) > 0 {
		exceptions, err := timeline.ComputeExceptions(c, app.ID, exceptionEvents)
		if err != nil {
			msg := fmt.Sprintf(`unable to compute exceptions for session %q for app %q`, sessionId, app.ID)
			fmt.Println(msg, err)
			c.JSON(http.StatusNotFound, gin.H{
				"error": msg,
			})
			return
		}
		threadedExceptions := timeline.GroupByThreads(exceptions)
		threads.Organize(event.TypeException, threadedExceptions)
	}

	anrEvents := eventMap[event.TypeANR]
	if len(anrEvents) > 0 {
		anrs, err := timeline.ComputeANRs(c, app.ID, anrEvents)
		if err != nil {
			msg := fmt.Sprintf(`unable to compute ANRs for session %q for app %q`, sessionId, app.ID)
			fmt.Println(msg, err)
			c.JSON(http.StatusNotFound, gin.H{
				"error": msg,
			})
			return
		}
		threadedANRs := timeline.GroupByThreads(anrs)
		threads.Organize(event.TypeANR, threadedANRs)
	}

	httpEvents := eventMap[event.TypeHttp]
	if len(httpEvents) > 0 {
		httpies := timeline.ComputeHttp(httpEvents)
		threadedHttpies := timeline.GroupByThreads(httpies)
		threads.Organize(event.TypeHttp, threadedHttpies)
	}

	threads.Sort()

	sessionTraces, err := span.FetchTracesForSessionId(ctx, appId, sessionId)
	if err != nil {
		msg := `failed to fetch trace data for timeline`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	response := gin.H{
		"session_id":            sessionId,
		"attribute":             session.Attribute,
		"app_id":                appId,
		"duration":              duration,
		"cpu_usage":             cpuUsages,
		"memory_usage":          memoryUsages,
		"memory_usage_absolute": memoryUsageAbsolutes,
		"threads":               threads,
		"traces":                sessionTraces,
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

func RenameApp(c *gin.Context) {
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
		msg := fmt.Sprintf(`you don't have permissions to modify app in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	if err := c.ShouldBindJSON(&app); err != nil {
		msg := `failed to parse app rename json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	err = app.rename()
	if err != nil {
		msg := `failed to rename app`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}

func CreateShortFilters(c *gin.Context) {
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	appId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	app := App{
		ID: &appId,
	}

	team, err := app.getTeam(c)
	if err != nil {
		msg := "failed to get team from app id"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if team == nil {
		msg := fmt.Sprintf("no team exists for app [%s]", app.ID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := PerformAuthz(userId, team.ID.String(), *ScopeAppRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to create short filters in team [%s]`, team.ID.String())
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	var payload filter.ShortFiltersPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse filters json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	// embed app id in filter payload
	payload.AppID = appId

	shortFilters, err := filter.NewShortFilters(payload)
	if err != nil {
		msg := `failed to create filter hash`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	if err = shortFilters.Create(ctx); err != nil {
		msg := `failed to create short code from filters`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"filter_short_code": shortFilters.Code,
	})
}

func GetRootSpanNames(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
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

	traceNames, err := span.FetchRootSpanNames(ctx, *app.ID)
	if err != nil {
		msg := "failed to get app's traces"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": traceNames,
	})
}

func GetSpansForSpanName(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	rawSpanName := c.Query("span_name")
	if rawSpanName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing span_name query param"})
		return
	}

	spanName, err := url.QueryUnescape(rawSpanName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid span_name query param"})
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "root spans request validation failed"
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

	spans, next, previous, err := span.GetSpansForSpanNameWithFilter(ctx, spanName, &af)
	if err != nil {
		msg := "failed to get app's root spans"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": spans,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetMetricsPlotForSpanName(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	rawSpanName := c.Query("span_name")
	if rawSpanName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing span_name query param"})
		return
	}

	spanName, err := url.QueryUnescape(rawSpanName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid span_name query param"})
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "span plot request validation failed"
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

	spanMetricsPlotInstances, err := span.GetMetricsPlotForSpanNameWithFilter(ctx, spanName, &af)
	if err != nil {
		msg := "failed to get span's plot"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	type instance struct {
		ID   string  `json:"id"`
		Data []gin.H `json:"data"`
	}

	lut := make(map[string]int)
	var instances []instance

	for i := range spanMetricsPlotInstances {
		instance := instance{
			ID: spanMetricsPlotInstances[i].Version,
			Data: []gin.H{{
				"datetime": spanMetricsPlotInstances[i].DateTime,
				"p50":      spanMetricsPlotInstances[i].P50,
				"p90":      spanMetricsPlotInstances[i].P90,
				"p95":      spanMetricsPlotInstances[i].P95,
				"p99":      spanMetricsPlotInstances[i].P99,
			}},
		}

		ndx, ok := lut[spanMetricsPlotInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[spanMetricsPlotInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetTrace(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	traceId := c.Param("traceId")

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

	trace, err := span.GetTrace(ctx, traceId)
	if err != nil {
		msg := "failed to get trace"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, trace)
}

func GetBugReportsOverview(c *gin.Context) {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := "bug reports overview request validation failed"
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

	bugReports, next, previous, err := GetBugReportsWithFilter(ctx, &af)
	if err != nil {
		msg := "failed to get app's bug reports"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"results": bugReports,
		"meta": gin.H{
			"next":     next,
			"previous": previous,
		},
	})
}

func GetBugReportsInstancesPlot(c *gin.Context) {
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

	if err := af.Expand(ctx); err != nil {
		msg := `failed to expand filters`
		fmt.Println(msg, err)
		status := http.StatusInternalServerError
		if errors.Is(err, pgx.ErrNoRows) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	msg := `bug reports plot request validation failed`

	if err := af.Validate(); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if !af.HasTimezone() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing required field `timezone`",
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

	bugReportInstances, err := GetBugReportInstancesPlot(ctx, &af)
	if err != nil {
		msg := `failed to query data for bug reports plot`
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

	for i := range bugReportInstances {
		instance := instance{
			ID: bugReportInstances[i].Version,
			Data: []gin.H{{
				"datetime":  bugReportInstances[i].DateTime,
				"instances": bugReportInstances[i].Instances,
			}},
		}

		ndx, ok := lut[bugReportInstances[i].Version]

		if ok {
			instances[ndx].Data = append(instances[ndx].Data, instance.Data...)
		} else {
			instances = append(instances, instance)
			lut[bugReportInstances[i].Version] = len(instances) - 1
		}
	}

	c.JSON(http.StatusOK, instances)
}

func GetBugReport(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	bugReportId := c.Param("bugReportId")

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

	bugReport, err := GetBugReportById(ctx, bugReportId)
	if err != nil {
		msg := "failed to get bug report"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, bugReport)
}

func UpdateBugReportStatus(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	bugReportId := c.Param("bugReportId")

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

	var payload BugReportStatusUpdatePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse bug report status update json payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	err = UpdateBugReportStatusById(ctx, bugReportId, *payload.Status)
	if err != nil {
		msg := "failed to update bug report status"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}
