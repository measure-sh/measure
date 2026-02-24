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

type GroupType string

const (
	GroupTypeCrash GroupType = "crash"
	GroupTypeANR   GroupType = "anr"
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
	CountryCode     string                 `json:"country_code"`
	Attribute       event.Attribute        `json:"-"`
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
	AppID       uuid.UUID        `json:"app_id" db:"app_id"`
	ID          string           `json:"id" db:"id"`
	CountryCode string           `json:"country_code"`
	Attribute   event.Attribute  `json:"-"`
	Type        string           `json:"type" db:"type"`
	Message     string           `json:"message" db:"message"`
	MethodName  string           `json:"method_name" db:"method_name"`
	FileName    string           `json:"file_name" db:"file_name"`
	LineNumber  int32            `json:"line_number" db:"line_number"`
	Count       uint64           `json:"count"`
	EventIDs    []uuid.UUID      `json:"event_ids,omitempty"`
	EventANRs   []event.EventANR `json:"anr_events,omitempty"`
	Percentage  float64          `json:"percentage_contribution"`
	UpdatedAt   time.Time        `json:"updated_at" db:"updated_at"`
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
		New("insert into unhandled_exception_groups").
		Clause("(").
		Expr("team_id").
		Expr("app_id").
		Expr("id").
		Expr("app_version").
		Expr("type").
		Expr("message").
		Expr("method_name").
		Expr("file_name").
		Expr("line_number").
		Expr("os_versions").
		Expr("country_codes").
		Expr("network_providers").
		Expr("network_types").
		Expr("network_generations").
		Expr("device_locales").
		Expr("device_manufacturers").
		Expr("device_names").
		Expr("device_models").
		Expr("count").
		Expr("timestamp").
		Clause(")").
		Clause("select").
		Expr("toUUID(?)", teamId).
		Expr("toUUID(?)", e.AppID).
		Expr("?", e.ID).
		Expr("(?, ?)", e.Attribute.AppVersion, e.Attribute.AppBuild).
		Expr("?", e.Type).
		Expr("?", e.Message).
		Expr("?", e.MethodName).
		Expr("?", e.FileName).
		Expr("?", e.LineNumber).
		Expr("groupUniqArrayState(tuple(?, ?))", e.Attribute.OSName, e.Attribute.OSVersion).
		Expr("groupUniqArrayState(?)", e.CountryCode).
		Expr("groupUniqArrayState(?)", e.Attribute.NetworkProvider).
		Expr("groupUniqArrayState(?)", e.Attribute.NetworkType).
		Expr("groupUniqArrayState(?)", e.Attribute.NetworkGeneration).
		Expr("groupUniqArrayState(?)", e.Attribute.DeviceLocale).
		Expr("groupUniqArrayState(?)", e.Attribute.DeviceManufacturer).
		Expr("groupUniqArrayState(?)", e.Attribute.DeviceName).
		Expr("groupUniqArrayState(?)", e.Attribute.DeviceModel).
		Expr("sumState(toUInt64(1))").
		Expr("toDateTime64(?, 3, 'UTC')", e.UpdatedAt.Format(chrono.MSTimeFormat))

	defer stmt.Close()

	return server.Server.ChPool.AsyncInsert(ctx, stmt.String(), true, stmt.Args()...)
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
		New("insert into anr_groups").
		Clause("(").
		Expr("team_id").
		Expr("app_id").
		Expr("id").
		Expr("app_version").
		Expr("type").
		Expr("message").
		Expr("method_name").
		Expr("file_name").
		Expr("line_number").
		Expr("os_versions").
		Expr("country_codes").
		Expr("network_providers").
		Expr("network_types").
		Expr("network_generations").
		Expr("device_locales").
		Expr("device_manufacturers").
		Expr("device_names").
		Expr("device_models").
		Expr("count").
		Expr("timestamp").
		Clause(")").
		Clause("select").
		Expr("?", teamId).
		Expr("?", a.AppID).
		Expr("?", a.ID).
		Expr("(?, ?)", a.Attribute.AppVersion, a.Attribute.AppBuild).
		Expr("?", a.Type).
		Expr("?", a.Message).
		Expr("?", a.MethodName).
		Expr("?", a.FileName).
		Expr("?", a.LineNumber).
		Expr("groupUniqArrayState(tuple(?, ?))", a.Attribute.OSName, a.Attribute.OSVersion).
		Expr("groupUniqArrayState(?)", a.CountryCode).
		Expr("groupUniqArrayState(?)", a.Attribute.NetworkProvider).
		Expr("groupUniqArrayState(?)", a.Attribute.NetworkType).
		Expr("groupUniqArrayState(?)", a.Attribute.NetworkGeneration).
		Expr("groupUniqArrayState(?)", a.Attribute.DeviceLocale).
		Expr("groupUniqArrayState(?)", a.Attribute.DeviceManufacturer).
		Expr("groupUniqArrayState(?)", a.Attribute.DeviceName).
		Expr("groupUniqArrayState(?)", a.Attribute.DeviceModel).
		Expr("sumState(toUInt64(1))").
		Expr("toDateTime64(?, 3, 'UTC')", a.UpdatedAt.Format(chrono.MSTimeFormat))

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
		From("unhandled_exception_groups final").
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
		From("anr_groups final").
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
func NewExceptionGroup(appId uuid.UUID, countryCode string, attribute event.Attribute, fingerprint string, exceptionType, message, methodName, fileName string, lineNumber int32, timestamp time.Time) *ExceptionGroup {
	return &ExceptionGroup{
		AppID:       appId,
		CountryCode: countryCode,
		Attribute:   attribute,
		ID:          fingerprint,
		Type:        exceptionType,
		Message:     message,
		MethodName:  methodName,
		FileName:    fileName,
		LineNumber:  lineNumber,
		UpdatedAt:   timestamp,
	}
}

// NewANRGroup constructs a new ANRGroup and returns a pointer to it.
func NewANRGroup(appId uuid.UUID, countryCode string, attribute event.Attribute, fingerprint string, anrType, message, methodName, fileName string, lineNumber int32, timestamp time.Time) *ANRGroup {
	return &ANRGroup{
		AppID:       appId,
		CountryCode: countryCode,
		Attribute:   attribute,
		ID:          fingerprint,
		Type:        anrType,
		Message:     message,
		MethodName:  methodName,
		FileName:    fileName,
		LineNumber:  lineNumber,
		UpdatedAt:   timestamp,
	}
}
