package group

import (
	"backend/api/ambient"
	"backend/api/chrono"
	"backend/api/event"
	"backend/api/filter"
	"backend/api/server"
	"context"
	"fmt"
	"math"
	"slices"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// IssueGroup interface represents
// common interface for issue group
// types like ExceptionGroup & ANRGroup.
type IssueGroup interface {
	GetId() string
}

type ExceptionGroup struct {
	AppID           uuid.UUID              `json:"app_id" db:"app_id"`
	ID              string                 `json:"id" db:"id"`
	Type            string                 `json:"type" db:"type"`
	Message         string                 `json:"message" db:"message"`
	MethodName      string                 `json:"method_name" db:"method_name"`
	FileName        string                 `json:"file_name" db:"file_name"`
	LineNumber      int32                  `json:"line_number" db:"line_number"`
	Count           uint64                 `json:"count"`
	EventIDs        []uuid.UUID            `json:"event_ids,omitempty"`
	EventExceptions []event.EventException `json:"exception_events,omitempty"`
	Percentage      float64                `json:"percentage_contribution"`
	UpdatedAt       time.Time              `json:"updated_at" db:"updated_at"`
}

type ANRGroup struct {
	AppID      uuid.UUID        `json:"app_id" db:"app_id"`
	ID         string           `json:"id" db:"id"`
	Type       string           `json:"type" db:"type"`
	Message    string           `json:"message" db:"message"`
	MethodName string           `json:"method_name" db:"method_name"`
	FileName   string           `json:"file_name" db:"file_name"`
	LineNumber int32            `json:"line_number" db:"line_number"`
	Count      uint64           `json:"count"`
	EventIDs   []uuid.UUID      `json:"event_ids,omitempty"`
	EventANRs  []event.EventANR `json:"anr_events,omitempty"`
	Percentage float64          `json:"percentage_contribution"`
	UpdatedAt  time.Time        `json:"updated_at" db:"updated_at"`
}

// unique deduplicates the source slice of
// string.
func unique(source []string) []string {
	if len(source) == 0 {
		return []string{}
	}

	seen := make(map[string]struct{}, len(source))
	result := make([]string, 0, len(source))

	for _, s := range source {
		if _, exists := seen[s]; !exists {
			seen[s] = struct{}{}
			result = append(result, s)
		}
	}

	return result
}

// GetId provides the exception's
// Id.
func (e ExceptionGroup) GetId() string {
	return e.ID
}

// GetDisplayTitle provides a user friendly display
// name for the Exception Group.
func (e ExceptionGroup) GetDisplayTitle() string {
	return e.Type + "@" + e.FileName
}

// EventExists checks if the given event id exists in
// the ExceptionGroup's events array.
func (e ExceptionGroup) EventExists(id uuid.UUID) bool {
	return slices.ContainsFunc(e.EventIDs, func(eventId uuid.UUID) bool {
		return eventId == id
	})
}

// Insert inserts a new ExceptionGroup into the database.
func (e *ExceptionGroup) Insert(ctx context.Context) (err error) {
	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return err
	}

	stmt := sqlf.
		InsertInto("unhandled_exception_groups").
		Set("team_id", teamId).
		Set("app_id", e.AppID).
		Set("id", e.ID).
		Set("type", e.Type).
		Set("message", e.Message).
		Set("method_name", e.MethodName).
		Set("file_name", e.FileName).
		Set("line_number", e.LineNumber).
		Set("created_at", time.Now()).
		Set("updated_at", e.UpdatedAt)

	defer stmt.Close()

	return server.Server.ChPool.AsyncInsert(ctx, stmt.String(), true, stmt.Args()...)
}

func (e ExceptionGroup) Upsert(ctx context.Context) (err error) {
	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return err
	}

	count := 0

	{
		stmt := sqlf.
			From("unhandled_exception_groups_new").
			Select("count").
			Where("team_id = toUUID(?)", teamId).
			Where("app_id = toUUID(?)", e.AppID).
			Where("id = toUUID(?)", e.ID)

		defer stmt.Close()

		if err = server.Server.RchPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&count); err != nil {
			return
		}
	}

	return
}

// GetId provides the ANR's
// Id.
func (a ANRGroup) GetId() string {
	return a.ID
}

// GetDisplayTitle provides a user friendly display
// name for the ANR Group.
func (a ANRGroup) GetDisplayTitle() string {
	return a.Type + "@" + a.FileName
}

// EventExists checks if the given event id exists in
// the ANRGroup's events array.
func (a ANRGroup) EventExists(id uuid.UUID) bool {
	return slices.ContainsFunc(a.EventIDs, func(eventId uuid.UUID) bool {
		return eventId.String() == id.String()
	})
}

// Insert inserts a new ANRGroup into the database.
func (a *ANRGroup) Insert(ctx context.Context) (err error) {
	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return err
	}

	stmt := sqlf.
		InsertInto("anr_groups").
		Set("team_id", teamId).
		Set("app_id", a.AppID).
		Set("id", a.ID).
		Set("type", a.Type).
		Set("message", a.Message).
		Set("method_name", a.MethodName).
		Set("file_name", a.FileName).
		Set("line_number", a.LineNumber).
		Set("created_at", time.Now()).
		Set("updated_at", a.UpdatedAt.Format(chrono.NanoTimeFormat))

	defer stmt.Close()

	return server.Server.ChPool.AsyncInsert(ctx, stmt.String(), true, stmt.Args()...)
}

// ComputeCrashContribution computes percentage of crash contribution from
// given slice of ExceptionGroup.
func ComputeCrashContribution(groups []ExceptionGroup) {
	total := uint64(0)

	for _, group := range groups {
		total = total + group.Count
	}

	for i := range groups {
		percentage := (float64(groups[i].Count) / float64(total)) * 100
		groups[i].Percentage = float64(math.Round(percentage*100) / 100)
	}
}

// ComputeANRContribution computes percentage of anr contribution from
// given slice of ANRGroup.
func ComputeANRContribution(groups []ANRGroup) {
	total := uint64(0)

	for _, group := range groups {
		total = total + group.Count
	}

	for i := range groups {
		percentage := (float64(groups[i].Count) / float64(total)) * 100
		groups[i].Percentage = float64(math.Round(percentage*100) / 100)
	}
}

// SortExceptionGroups first sorts a slice of ExceptionGroup
// with descending count.
func SortExceptionGroups(groups []ExceptionGroup) {
	sort.SliceStable(groups, func(i, j int) bool {
		return groups[i].Count > groups[j].Count
	})
}

// SortANRGroups first sorts a slice of ANRGroup
// with descending count.
func SortANRGroups(groups []ANRGroup) {
	sort.SliceStable(groups, func(i, j int) bool {
		return groups[i].Count > groups[j].Count
	})
}

// GetExceptionGroupsFromFingerprints fetches exception groups
// matched by app filter(s) & exception fingerprint.
func GetExceptionGroupsFromFingerprints(ctx context.Context, af *filter.AppFilter, input []string) (exceptionGroups []ExceptionGroup, err error) {
	fingerprints := unique(input)

	if len(fingerprints) == 0 {
		return
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From("unhandled_exception_groups_new final").
		Select("id").
		Select("any(type) as type").
		Select("any(message) as message").
		Select("any(method_name) as method_name").
		Select("any(file_name) as file_name").
		Select("any(line_number) as line_number").
		Select("sumMerge(count) as count").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer stmt.Close()

	if af.HasVersions() {
		stmt.Where("app_version.1 in ?", af.Versions)
		stmt.Where("app_version.2 in ?", af.VersionCodes)
	}

	stmt.Where("id").In(fingerprints)
	stmt.GroupBy("id")

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var exceptionGroup ExceptionGroup

		if err = rows.Scan(
			&exceptionGroup.ID,
			&exceptionGroup.Type,
			&exceptionGroup.Message,
			&exceptionGroup.MethodName,
			&exceptionGroup.FileName,
			&exceptionGroup.LineNumber,
			&exceptionGroup.Count,
		); err != nil {
			return
		}

		exceptionGroups = append(exceptionGroups, exceptionGroup)
	}

	err = rows.Err()

	return
}

// GetANRGroupsFromFingerprints fetches ANR groups
// matched by app filter(s) & ANR fingerprint.
func GetANRGroupsFromFingerprints(ctx context.Context, af *filter.AppFilter, input []string) (anrGroups []ANRGroup, err error) {
	fingerprints := unique(input)

	if len(fingerprints) == 0 {
		return
	}

	teamId, err := ambient.TeamId(ctx)
	if err != nil {
		return
	}

	stmt := sqlf.
		From("anr_groups_new final").
		Select("id").
		Select("any(type) as type").
		Select("any(message) as message").
		Select("any(method_name) as method_name").
		Select("any(file_name) as file_name").
		Select("any(line_number) as line_number").
		Select("sumMerge(count) as count").
		Where("team_id = toUUID(?)", teamId).
		Where("app_id = toUUID(?)", af.AppID).
		Where("timestamp >= ? and timestamp <= ?", af.From, af.To)

	defer stmt.Close()

	if af.HasVersions() {
		stmt.Where("app_version.1 in ?", af.Versions)
		stmt.Where("app_version.2 in ?", af.VersionCodes)
	}

	stmt.Where("id").In(fingerprints)
	stmt.GroupBy("id")

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return
	}

	for rows.Next() {
		var anrGroup ANRGroup

		if err = rows.Scan(
			&anrGroup.ID,
			&anrGroup.Type,
			&anrGroup.Message,
			&anrGroup.MethodName,
			&anrGroup.FileName,
			&anrGroup.LineNumber,
			&anrGroup.Count,
		); err != nil {
			return
		}

		anrGroups = append(anrGroups, anrGroup)
	}

	err = rows.Err()

	return
}

// GetExceptionGroupsFromExceptionIds gets exception groups
// matched by app filter(s) and exception event ids.
func GetExceptionGroupsFromExceptionIds(ctx context.Context, af *filter.AppFilter, eventIds []uuid.UUID) (exceptionGroups []ExceptionGroup, err error) {
	// Get list of fingerprints and event IDs
	eventDataStmt := sqlf.From(`events`).
		Select(`id, exception.fingerprint`).
		Where("app_id = toUUID(?)", af.AppID).
		Where("id in ?", eventIds)
	defer eventDataStmt.Close()

	eventDataRows, err := server.Server.ChPool.Query(ctx, eventDataStmt.String(), eventDataStmt.Args()...)

	if err != nil {
		return nil, err
	}
	if eventDataRows == nil {
		return nil, fmt.Errorf("rows is nil after query")
	}
	defer eventDataRows.Close()
	if eventDataRows.Err() != nil {
		return nil, eventDataRows.Err()
	}

	fingerprints := make([]string, 0)
	fingerprintSet := make(map[string]struct{})
	eventIdToFingerprint := make(map[uuid.UUID]string)

	for eventDataRows.Next() {
		var eventID uuid.UUID
		var fingerprint string
		if err := eventDataRows.Scan(&eventID, &fingerprint); err != nil {
			return nil, err
		}
		eventIdToFingerprint[eventID] = fingerprint
		if _, exists := fingerprintSet[fingerprint]; !exists {
			fingerprints = append(fingerprints, fingerprint)
			fingerprintSet[fingerprint] = struct{}{}
		}
	}

	// Query groups that match the obtained fingerprints
	stmt := sqlf.
		From(`unhandled_exception_groups`).
		Select(`id`).
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Where(`id IN ?`, fingerprints)
	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)

	if err != nil {
		return nil, err
	}
	if rows == nil {
		return nil, fmt.Errorf("rows is nil after query")
	}
	defer rows.Close()
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	exceptionGroups = make([]ExceptionGroup, 0)
	for rows.Next() {
		var group ExceptionGroup
		err := rows.Scan(
			&group.ID,
			&group.Type,
			&group.Message,
			&group.MethodName,
			&group.FileName,
			&group.LineNumber,
		)
		if err != nil {
			return nil, err
		}
		exceptionGroups = append(exceptionGroups, group)
	}

	// Add event ids to obtained exception groups
	fingerprintToGroup := make(map[string]*ExceptionGroup)
	for i := range exceptionGroups {
		fingerprintToGroup[exceptionGroups[i].ID] = &exceptionGroups[i]
	}

	for eventID, fingerprint := range eventIdToFingerprint {
		if group, ok := fingerprintToGroup[fingerprint]; ok {
			group.EventIDs = append(group.EventIDs, eventID)
		}
	}

	return exceptionGroups, nil
}

// GetANRGroupsFromANRIds gets ANR groups
// matched by app filter(s) and ANR event ids.
func GetANRGroupsFromANRIds(ctx context.Context, af *filter.AppFilter, eventIds []uuid.UUID) (anrGroups []ANRGroup, err error) {
	// Get list of fingerprints and event IDs
	eventDataStmt := sqlf.From(`events`).
		Select(`id, anr.fingerprint`).
		Where("app_id = toUUID(?)", af.AppID).
		Where(`id in ?`, eventIds)
	defer eventDataStmt.Close()

	eventDataRows, err := server.Server.ChPool.Query(ctx, eventDataStmt.String(), eventDataStmt.Args()...)

	if err != nil {
		return nil, err
	}
	if eventDataRows == nil {
		return nil, fmt.Errorf("rows is nil after query")
	}
	defer eventDataRows.Close()
	if eventDataRows.Err() != nil {
		return nil, eventDataRows.Err()
	}

	fingerprints := make([]string, 0)
	fingerprintSet := make(map[string]struct{})
	eventIdToFingerprint := make(map[uuid.UUID]string)

	for eventDataRows.Next() {
		var eventID uuid.UUID
		var fingerprint string
		if err := eventDataRows.Scan(&eventID, &fingerprint); err != nil {
			return nil, err
		}
		eventIdToFingerprint[eventID] = fingerprint
		if _, exists := fingerprintSet[fingerprint]; !exists {
			fingerprints = append(fingerprints, fingerprint)
			fingerprintSet[fingerprint] = struct{}{}
		}
	}

	// Query groups that match the obtained fingerprints
	stmt := sqlf.
		From(`anr_groups`).
		Select(`id`).
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Where(`id IN ?`, fingerprints)
	defer stmt.Close()

	rows, err := server.Server.ChPool.Query(ctx, stmt.String(), stmt.Args()...)

	if err != nil {
		return nil, err
	}
	if rows == nil {
		return nil, fmt.Errorf("rows is nil after query")
	}
	defer rows.Close()
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	anrGroups = make([]ANRGroup, 0)
	for rows.Next() {
		var group ANRGroup
		err := rows.Scan(
			&group.ID,
			&group.Type,
			&group.Message,
			&group.MethodName,
			&group.FileName,
			&group.LineNumber,
		)
		if err != nil {
			return nil, err
		}
		anrGroups = append(anrGroups, group)
	}

	// Add event ids to obtained ANR groups
	fingerprintToGroup := make(map[string]*ANRGroup)
	for i := range anrGroups {
		fingerprintToGroup[anrGroups[i].ID] = &anrGroups[i]
	}

	for eventID, fingerprint := range eventIdToFingerprint {
		if group, ok := fingerprintToGroup[fingerprint]; ok {
			group.EventIDs = append(group.EventIDs, eventID)
		}
	}

	return anrGroups, nil
}

// NewExceptionGroup constructs a new ExceptionGroup and returns a pointer to it.
func NewExceptionGroup(appId uuid.UUID, fingerprint string, exceptionType, message, methodName, fileName string, lineNumber int32, firstTime time.Time) *ExceptionGroup {
	return &ExceptionGroup{
		AppID:      appId,
		ID:         fingerprint,
		Type:       exceptionType,
		Message:    message,
		MethodName: methodName,
		FileName:   fileName,
		LineNumber: lineNumber,
		UpdatedAt:  time.Now(),
	}
}

// NewANRGroup constructs a new ANRGroup and returns a pointer to it.
func NewANRGroup(appId uuid.UUID, fingerprint string, anrType, message, methodName, fileName string, lineNumber int32, firstTime time.Time) *ANRGroup {
	return &ANRGroup{
		AppID:      appId,
		ID:         fingerprint,
		Type:       anrType,
		Message:    message,
		MethodName: methodName,
		FileName:   fileName,
		LineNumber: lineNumber,
		UpdatedAt:  time.Now(),
	}
}
