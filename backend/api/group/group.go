package group

import (
	"backend/api/chrono"
	"backend/api/event"
	"backend/api/filter"
	"backend/api/server"
	"context"
	"math"
	"slices"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

// IssueGroup interface represents
// common interface for issue group
// types like ExceptionGroup & ANRGroup.
type IssueGroup interface {
	GetFingerprint() string
}

type ExceptionGroup struct {
	ID              uuid.UUID              `json:"id" db:"id"`
	AppID           uuid.UUID              `json:"app_id" db:"app_id"`
	Type            string                 `json:"type" db:"type"`
	Message         string                 `json:"message" db:"message"`
	MethodName      string                 `json:"method_name" db:"method_name"`
	FileName        string                 `json:"file_name" db:"file_name"`
	LineNumber      int                    `json:"line_number" db:"line_number"`
	Fingerprint     string                 `json:"fingerprint" db:"fingerprint"`
	Count           int                    `json:"count"`
	EventIDs        []uuid.UUID            `json:"event_ids,omitempty"`
	EventExceptions []event.EventException `json:"exception_events,omitempty"`
	Percentage      float32                `json:"percentage_contribution"`
	FirstEventTime  time.Time              `json:"-" db:"first_event_timestamp"`
	CreatedAt       chrono.ISOTime         `json:"created_at" db:"created_at"`
	UpdatedAt       chrono.ISOTime         `json:"updated_at" db:"updated_at"`
}

type ANRGroup struct {
	ID             uuid.UUID        `json:"id" db:"id"`
	AppID          uuid.UUID        `json:"app_id" db:"app_id"`
	Type           string           `json:"type" db:"type"`
	Message        string           `json:"message" db:"message"`
	MethodName     string           `json:"method_name" db:"method_name"`
	FileName       string           `json:"file_name" db:"file_name"`
	LineNumber     int              `json:"line_number" db:"line_number"`
	Fingerprint    string           `json:"fingerprint" db:"fingerprint"`
	Count          int              `json:"count"`
	EventIDs       []uuid.UUID      `json:"event_ids,omitempty"`
	EventANRs      []event.EventANR `json:"anr_events,omitempty"`
	Percentage     float32          `json:"percentage_contribution"`
	FirstEventTime time.Time        `json:"-" db:"first_event_timestamp"`
	CreatedAt      chrono.ISOTime   `json:"created_at" db:"created_at"`
	UpdatedAt      chrono.ISOTime   `json:"updated_at" db:"updated_at"`
}

func (e ExceptionGroup) GetID() uuid.UUID {
	return e.ID
}

// GetFingerprint provides the exception's
// fingerprint.
func (e ExceptionGroup) GetFingerprint() string {
	return e.Fingerprint
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

// UpdateTimeStamps updates the updated_at timestamp of the
// ExceptionGroup. Additionally, if the event's timestamp is
// older than the group's timestamp, then update the group's
// timestamp.
func (e ExceptionGroup) UpdateTimeStamps(ctx context.Context, event *event.EventField, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		Update("unhandled_exception_groups").
		Set("updated_at", time.Now()).
		Where("id = ?", e.ID)

	if event.Timestamp.Before(e.FirstEventTime) {
		stmt.Set("first_event_timestamp", event.Timestamp)
	}

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// Insert inserts a new ExceptionGroup into the database.
func (e *ExceptionGroup) Insert(ctx context.Context, tx *pgx.Tx) (err error) {
	id, err := uuid.NewV7()
	if err != nil {
		return
	}

	stmt := sqlf.PostgreSQL.
		InsertInto("unhandled_exception_groups").
		Set("id", id).
		Set("app_id", e.AppID).
		Set("type", e.Type).
		Set("message", e.Message).
		Set("method_name", e.MethodName).
		Set("file_name", e.FileName).
		Set("line_number", e.LineNumber).
		Set("fingerprint", e.Fingerprint).
		Set("first_event_timestamp", e.FirstEventTime)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

func (a ANRGroup) GetID() uuid.UUID {
	return a.ID
}

// GetFingerprint provides the ANR's
// fingerprint.
func (a ANRGroup) GetFingerprint() string {
	return a.Fingerprint
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

// UpdateTimeStamps updates the updated_at timestamp of the
// ANRGroup. Additionally, if the event's timestamp is
// older than the group's timestamp, then update the group's
// timestamp.
func (e ANRGroup) UpdateTimeStamps(ctx context.Context, event *event.EventField, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		Update("anr_groups").
		Set("updated_at", time.Now()).
		Where("id = ?", e.ID)

	if event.Timestamp.Before(e.FirstEventTime) {
		stmt.Set("first_event_timestamp", event.Timestamp)
	}

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// Insert inserts a new ANRGroup into the database.
func (a *ANRGroup) Insert(ctx context.Context, tx *pgx.Tx) (err error) {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}

	stmt := sqlf.PostgreSQL.
		InsertInto("anr_groups").
		Set("id", id).
		Set("app_id", a.AppID).
		Set("type", a.Type).
		Set("message", a.Message).
		Set("method_name", a.MethodName).
		Set("file_name", a.FileName).
		Set("line_number", a.LineNumber).
		Set("fingerprint", a.Fingerprint).
		Set("first_event_timestamp", a.FirstEventTime)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// ComputeCrashContribution computes percentage of crash contribution from
// given slice of ExceptionGroup.
func ComputeCrashContribution(groups []ExceptionGroup) {
	total := 0

	for _, group := range groups {
		total = total + group.Count
	}

	for i := range groups {
		percentage := (float64(groups[i].Count) / float64(total)) * 100
		groups[i].Percentage = float32(math.Round(percentage*100) / 100)
	}
}

// ComputeANRContribution computes percentage of anr contribution from
// given slice of ANRGroup.
func ComputeANRContribution(groups []ANRGroup) {
	total := 0

	for _, group := range groups {
		total = total + group.Count
	}

	for i := range groups {
		percentage := (float64(groups[i].Count) / float64(total)) * 100
		groups[i].Percentage = float32(math.Round(percentage*100) / 100)
	}
}

// SortExceptionGroups first sorts a slice of ExceptionGroup
// with descending count and then ascending ID.
func SortExceptionGroups(groups []ExceptionGroup) {
	sort.SliceStable(groups, func(i, j int) bool {
		if groups[i].Count != groups[j].Count {
			return groups[i].Count > groups[j].Count
		}
		return groups[i].ID.String() < groups[j].ID.String()
	})
}

// SortANRGroups first sorts a slice of ANRGroup
// with descending count and then ascending ID.
func SortANRGroups(groups []ANRGroup) {
	sort.SliceStable(groups, func(i, j int) bool {
		if groups[i].Count != groups[j].Count {
			return groups[i].Count > groups[j].Count
		}
		return groups[i].ID.String() < groups[j].ID.String()
	})
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
	defer eventDataRows.Close()

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

	if eventDataRows.Err() != nil {
		return nil, eventDataRows.Err()
	}

	// Query groups that match the obtained fingerprints
	stmt := sqlf.PostgreSQL.
		From(`unhandled_exception_groups`).
		Select(`id`).
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select(`fingerprint`).
		Where(`fingerprint = ANY(?)`, fingerprints)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	exceptionGroups, err = pgx.CollectRows(rows, pgx.RowToStructByNameLax[ExceptionGroup])

	if err != nil {
		return nil, err
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	// Add event ids to obtained exception groups
	fingerprintToGroup := make(map[string]*ExceptionGroup)
	for i := range exceptionGroups {
		fingerprintToGroup[exceptionGroups[i].Fingerprint] = &exceptionGroups[i]
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

	eventDataRows, err := server.Server.ChPool.Query(ctx, eventDataStmt.String(), eventDataStmt.Args()...)
	if err != nil {
		return nil, err
	}
	defer eventDataRows.Close()

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

	if eventDataRows.Err() != nil {
		return nil, eventDataRows.Err()
	}

	// Query groups that match the obtained fingerprints
	stmt := sqlf.PostgreSQL.
		From(`anr_groups`).
		Select(`id`).
		Select(`type`).
		Select(`message`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select(`fingerprint`).
		Where(`fingerprint = ANY(?)`, fingerprints)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	anrGroups, err = pgx.CollectRows(rows, pgx.RowToStructByNameLax[ANRGroup])

	if err != nil {
		return nil, err
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	// Add event ids to obtained ANR groups
	fingerprintToGroup := make(map[string]*ANRGroup)
	for i := range anrGroups {
		fingerprintToGroup[anrGroups[i].Fingerprint] = &anrGroups[i]
	}

	for eventID, fingerprint := range eventIdToFingerprint {
		if group, ok := fingerprintToGroup[fingerprint]; ok {
			group.EventIDs = append(group.EventIDs, eventID)
		}
	}

	return anrGroups, nil
}

// NewExceptionGroup constructs a new ExceptionGroup and returns a pointer to it.
func NewExceptionGroup(appId uuid.UUID, exceptionType, message, methodName, fileName string, lineNumber int, fingerprint string, firstTime time.Time) *ExceptionGroup {
	return &ExceptionGroup{
		AppID:          appId,
		Type:           exceptionType,
		Message:        message,
		MethodName:     methodName,
		FileName:       fileName,
		LineNumber:     lineNumber,
		Fingerprint:    fingerprint,
		FirstEventTime: firstTime,
	}
}

// NewANRGroup constructs a new ANRGroup and returns a pointer to it.
func NewANRGroup(appId uuid.UUID, anrType, message, methodName, fileName string, lineNumber int, fingerprint string, firstTime time.Time) *ANRGroup {
	return &ANRGroup{
		AppID:          appId,
		Type:           anrType,
		Message:        message,
		MethodName:     methodName,
		FileName:       fileName,
		LineNumber:     lineNumber,
		Fingerprint:    fingerprint,
		FirstEventTime: firstTime,
	}
}
