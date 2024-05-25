package group

import (
	"context"
	"measure-backend/measure-go/chrono"
	"measure-backend/measure-go/event"
	"measure-backend/measure-go/filter"
	"measure-backend/measure-go/server"
	"slices"
	"sort"
	"strconv"
	"time"

	"github.com/go-dedup/simhash"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

// MatchingHammingDistance is the minimum hamming
// distance above which two similar exceptions or
// ANRs are considered unique.
var MinHammingDistance = 3

type GroupID interface {
	GetID() uuid.UUID
}

type ExceptionGroup struct {
	ID              uuid.UUID              `json:"id" db:"id"`
	AppID           uuid.UUID              `json:"app_id" db:"app_id"`
	Name            string                 `json:"name" db:"name"`
	Fingerprint     string                 `json:"fingerprint" db:"fingerprint"`
	Count           int                    `json:"count" db:"count"`
	EventIDs        []uuid.UUID            `json:"event_ids,omitempty" db:"event_ids"`
	EventExceptions []event.EventException `json:"exception_events,omitempty"`
	Percentage      float32                `json:"percentage_contribution"`
	CreatedAt       chrono.ISOTime         `json:"created_at" db:"created_at"`
	UpdatedAt       chrono.ISOTime         `json:"updated_at" db:"updated_at"`
}

type ANRGroup struct {
	ID          uuid.UUID        `json:"id" db:"id"`
	AppID       uuid.UUID        `json:"app_id" db:"app_id"`
	Name        string           `json:"name" db:"name"`
	Fingerprint string           `json:"fingerprint" db:"fingerprint"`
	Count       int              `json:"count" db:"count"`
	EventIDs    []uuid.UUID      `json:"event_ids,omitempty" db:"event_ids"`
	EventANRs   []event.EventANR `json:"anr_events,omitempty"`
	Percentage  float32          `json:"percentage_contribution"`
	CreatedAt   chrono.ISOTime   `json:"created_at" db:"created_at"`
	UpdatedAt   chrono.ISOTime   `json:"updated_at" db:"updated_at"`
}

func (e ExceptionGroup) GetID() uuid.UUID {
	return e.ID
}

// EventExists checks if the given event id exists in
// the ExceptionGroup's events array.
func (e ExceptionGroup) EventExists(id uuid.UUID) bool {
	return slices.ContainsFunc(e.EventIDs, func(eventId uuid.UUID) bool {
		return eventId.String() == id.String()
	})
}

// AppendEventId appends a new event id to the ExceptionGroup's
// events array.
func (e ExceptionGroup) AppendEventId(ctx context.Context, id uuid.UUID, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		Update("public.unhandled_exception_groups").
		SetExpr("event_ids", "array_append(event_ids, ?)", id).
		Set("updated_at", time.Now()).
		Where("id = ?", e.ID)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// HammingDistance calculates the hamming distance between the
// exception's fingerprint with any arbitrary fingerprint
// represented as a 64 bit unsigned integer returning
// the distance.
func (e ExceptionGroup) HammingDistance(a uint64) (uint8, error) {
	b, err := strconv.ParseUint(e.Fingerprint, 16, 64)
	if err != nil {
		return 0, err
	}

	return simhash.Compare(a, b), nil
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
		Set("name", e.Name).
		Set("fingerprint", e.Fingerprint).
		Set("event_ids", e.EventIDs)

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

// EventExists checks if the given event id exists in
// the ANRGroup's events array.
func (a ANRGroup) EventExists(id uuid.UUID) bool {
	return slices.ContainsFunc(a.EventIDs, func(eventId uuid.UUID) bool {
		return eventId.String() == id.String()
	})
}

// AppendEventId appends a new event id to the ANRGroup's
// events array.
func (a ANRGroup) AppendEventId(ctx context.Context, id uuid.UUID, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		Update("public.anr_groups").
		SetExpr("event_ids", "array_append(event_ids, ?)", id).
		Set("updated_at", time.Now()).
		Where("id = ?", a.ID)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// HammingDistance calculates the hamming distance between the
// anr's fingerprint with any arbitrary fingerprint
// represented as a 64 bit unsigned integer returning
// the distance.
func (anr ANRGroup) HammingDistance(a uint64) (uint8, error) {
	b, err := strconv.ParseUint(anr.Fingerprint, 16, 64)
	if err != nil {
		return 0, err
	}

	return simhash.Compare(a, b), nil
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
		Set("name", a.Name).
		Set("fingerprint", a.Fingerprint).
		Set("event_ids", a.EventIDs)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// GetExceptionGroup gets the ExceptionGroup by matching
// ExceptionGroup id and app id.
func GetExceptionGroup(eg *ExceptionGroup) error {
	stmt := sqlf.PostgreSQL.Select("name, fingerprint, event_ids, created_at, updated_at").
		From("public.unhandled_exception_groups").
		Where("id = ? and app_id = ?", nil, nil)
	defer stmt.Close()

	return server.Server.PgPool.QueryRow(context.Background(), stmt.String(), eg.ID, eg.AppID).Scan(&eg.Name, &eg.Fingerprint, &eg.EventIDs, &eg.CreatedAt, &eg.UpdatedAt)
}

// GetANRGroup gets the ANRGroup by matching
// ANRGroup id and app id.
func GetANRGroup(ag *ANRGroup) error {
	stmt := sqlf.PostgreSQL.Select("name, fingerprint, event_ids, created_at, updated_at").
		From("public.anr_groups").
		Where("id = ? and app_id = ?", nil, nil)
	defer stmt.Close()

	return server.Server.PgPool.QueryRow(context.Background(), stmt.String(), ag.ID, ag.AppID).Scan(&ag.Name, &ag.Fingerprint, &ag.EventIDs, &ag.CreatedAt, &ag.UpdatedAt)
}

// ClosestExceptionGroup finds the index of the ExceptionGroup closest to
// an arbitrary fingerprint from a slice of ExceptionGroup.
func ClosestExceptionGroup(groups []ExceptionGroup, fingerprint uint64) (int, error) {
	lowest := -1
	var min uint8 = uint8(MinHammingDistance)
	for index, group := range groups {
		distance, err := group.HammingDistance(fingerprint)
		if err != nil {
			return 0, err
		}

		if distance <= min {
			min = distance
			lowest = index
		}
	}

	return lowest, nil
}

// ClosestANRGroup finds the index of the ANRGroup closest to
// an arbitrary fingerprint from a slice of ANRGroup.
func ClosestANRGroup(groups []ANRGroup, fingerprint uint64) (int, error) {
	lowest := -1
	var min uint8 = uint8(MinHammingDistance)
	for index, group := range groups {
		distance, err := group.HammingDistance(fingerprint)
		if err != nil {
			return 0, err
		}

		if distance <= min {
			min = distance
			lowest = index
		}
	}

	return lowest, nil
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
		Select(`name`).
		Select(`event_ids`).
		// `&&` matches rows by list of uuids
		Where(`event_ids && ?`, eventIds)

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	exceptionGroups, err = pgx.CollectRows(rows, pgx.RowToStructByNameLax[ExceptionGroup])

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
func NewExceptionGroup(appId uuid.UUID, name string, fingerprint string, eventIds []uuid.UUID) *ExceptionGroup {
	return &ExceptionGroup{
		AppID:       appId,
		Name:        name,
		Fingerprint: fingerprint,
		EventIDs:    eventIds,
	}
}

// NewANRGroup constructs a new ANRGroup and returns a pointer to it.
func NewANRGroup(appId uuid.UUID, name string, fingerprint string, eventIds []uuid.UUID) *ANRGroup {
	return &ANRGroup{
		AppID:       appId,
		Name:        name,
		Fingerprint: fingerprint,
		EventIDs:    eventIds,
	}
}
