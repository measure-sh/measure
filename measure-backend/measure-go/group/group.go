package group

import (
	"context"
	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/event"
	"measure-backend/measure-go/filter"
	"measure-backend/measure-go/server"
	"slices"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type GroupID interface {
	GetID() uuid.UUID
}

type ExceptionGroup struct {
	ID              uuid.UUID              `json:"id" db:"id"`
	AppID           uuid.UUID              `json:"app_id" db:"app_id"`
	Type            string                 `json:"type" db:"type"`
	Msg             string                 `json:"msg" db:"msg"`
	MethodName      string                 `json:"method_name" db:"method_name"`
	FileName        string                 `json:"file_name" db:"file_name"`
	LineNumber      int                    `json:"line_number" db:"line_number"`
	Fingerprint     string                 `json:"fingerprint" db:"fingerprint"`
	Count           int                    `json:"count" db:"count"`
	EventIDs        []uuid.UUID            `json:"event_ids,omitempty" db:"event_ids"`
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
	Msg            string           `json:"msg" db:"msg"`
	MethodName     string           `json:"method_name" db:"method_name"`
	FileName       string           `json:"file_name" db:"file_name"`
	LineNumber     int              `json:"line_number" db:"line_number"`
	Fingerprint    string           `json:"fingerprint" db:"fingerprint"`
	Count          int              `json:"count" db:"count"`
	EventIDs       []uuid.UUID      `json:"event_ids,omitempty" db:"event_ids"`
	EventANRs      []event.EventANR `json:"anr_events,omitempty"`
	Percentage     float32          `json:"percentage_contribution"`
	FirstEventTime time.Time        `json:"-" db:"first_event_timestamp"`
	CreatedAt      chrono.ISOTime   `json:"created_at" db:"created_at"`
	UpdatedAt      chrono.ISOTime   `json:"updated_at" db:"updated_at"`
}

func (e ExceptionGroup) GetID() uuid.UUID {
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

// AppendEvent appends a new event id to the ExceptionGroup's
// events array. Additionally, if the event's timestamp is
// older than the group's timestamp, then update the group's
// timestamp.
func (e ExceptionGroup) AppendEvent(ctx context.Context, event *event.EventField, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		Update("public.unhandled_exception_groups").
		SetExpr("event_ids", "array_append(event_ids, ?)", event.ID).
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
		InsertInto("public.unhandled_exception_groups").
		Set("id", id).
		Set("app_id", e.AppID).
		Set("type", e.Type).
		Set("msg", e.Msg).
		Set("method_name", e.MethodName).
		Set("file_name", e.FileName).
		Set("line_number", e.LineNumber).
		Set("fingerprint", e.Fingerprint).
		Set("event_ids", e.EventIDs).
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

// AppendEvent appends a new event id to the ANRGroup's
// events array. Additionally, if the event's timestamp is
// older than the group's timestamp, then update the group's
// timestamp.
func (e ANRGroup) AppendEvent(ctx context.Context, event *event.EventField, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		Update("public.anr_groups").
		SetExpr("event_ids", "array_append(event_ids, ?)", event.ID).
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
		InsertInto("public.anr_groups").
		Set("id", id).
		Set("app_id", a.AppID).
		Set("type", a.Type).
		Set("msg", a.Msg).
		Set("method_name", a.MethodName).
		Set("file_name", a.FileName).
		Set("line_number", a.LineNumber).
		Set("fingerprint", a.Fingerprint).
		Set("event_ids", a.EventIDs).
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
		groups[i].Percentage = (float32(groups[i].Count) / float32(total)) * 100
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
		groups[i].Percentage = (float32(groups[i].Count) / float32(total)) * 100
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
// matched by exception ids.
func GetExceptionGroupsFromExceptionIds(ctx context.Context, eventIds []uuid.UUID) (exceptionGroups []ExceptionGroup, err error) {
	stmt := sqlf.PostgreSQL.
		From(`public.unhandled_exception_groups`).
		Select(`id`).
		Select(`type`).
		Select(`msg`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select(`event_ids`).
		// `&&` matches rows by list of uuids
		Where(`event_ids && ?`, eventIds)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	exceptionGroups, err = pgx.CollectRows(rows, pgx.RowToStructByNameLax[ExceptionGroup])

	err = rows.Err()

	return
}

// GetANRGroupsFromANRIds gets anr groups
// matched by anr ids.
func GetANRGroupsFromANRIds(ctx context.Context, eventIds []uuid.UUID) (anrGroups []ANRGroup, err error) {
	stmt := sqlf.PostgreSQL.
		From(`public.anr_groups`).
		Select(`id`).
		Select(`type`).
		Select(`msg`).
		Select(`method_name`).
		Select(`file_name`).
		Select(`line_number`).
		Select(`event_ids`).
		// `&&` matches rows by list of uuids
		Where(`event_ids && ?`, eventIds)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	anrGroups, err = pgx.CollectRows(rows, pgx.RowToStructByNameLax[ANRGroup])

	err = rows.Err()

	return
}

// PaginateGroups accepts slice of interface GroupID and computes and
// returns a subset slice along with pagination meta, like next and previous.
func PaginateGroups[T GroupID](groups []T, af *filter.AppFilter) (sliced []T, next bool, previous bool) {
	sliced = groups
	next = false
	previous = false

	length := len(groups)

	// no change if slice is empty
	if length == 0 {
		return
	}

	start := 0
	for i := range groups {
		if groups[i].GetID().String() == af.KeyID {
			if af.Limit > 0 {
				start = i + 1
			} else {
				start = i
			}
			break
		}
	}

	end := start + af.Limit

	if af.Limit > 0 {
		if end > len(groups) {
			end = len(groups)
		}
		if end < len(groups) {
			next = true
		}
		if start > 0 {
			previous = true
		}
		if start >= length {
			start = 0
			end = 0
		}
		sliced = groups[start:end]
	} else if af.Limit < 0 {
		if end < 0 {
			end = 0
		}
		if end < len(groups) {
			next = true
		}
		if end > 0 {
			previous = true
		}
		sliced = groups[end:start]
	}

	return
}

// NewExceptionGroup constructs a new ExceptionGroup and returns a pointer to it.
func NewExceptionGroup(appId uuid.UUID, exceptionType, msg, methodName, fileName string, lineNumber int, fingerprint string, eventIds []uuid.UUID, firstTime time.Time) *ExceptionGroup {
	return &ExceptionGroup{
		AppID:          appId,
		Type:           exceptionType,
		Msg:            msg,
		MethodName:     methodName,
		FileName:       fileName,
		LineNumber:     lineNumber,
		Fingerprint:    fingerprint,
		EventIDs:       eventIds,
		FirstEventTime: firstTime,
	}
}

// NewANRGroup constructs a new ANRGroup and returns a pointer to it.
func NewANRGroup(appId uuid.UUID, anrType, msg, methodName, fileName string, lineNumber int, fingerprint string, eventIds []uuid.UUID, firstTime time.Time) *ANRGroup {
	return &ANRGroup{
		AppID:          appId,
		Type:           anrType,
		Msg:            msg,
		MethodName:     methodName,
		FileName:       fileName,
		LineNumber:     lineNumber,
		Fingerprint:    fingerprint,
		EventIDs:       eventIds,
		FirstEventTime: firstTime,
	}
}
