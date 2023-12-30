package measure

import (
	"context"
	"measure-backend/measure-go/server"
	"slices"
	"strconv"
	"time"

	"github.com/go-dedup/simhash"
	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// MatchingHammingDistance is the minimum hamming
// distance above which two similar exceptions or
// ANRs are considered unique.
var MinHammingDistance = 3

type ExceptionGroup struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	AppID       uuid.UUID   `json:"app_id" db:"app_id"`
	Name        string      `json:"name" db:"name"`
	Fingerprint string      `json:"fingerprint" db:"fingerprint"`
	Count       int         `json:"count" db:"count"`
	Events      []uuid.UUID `json:"events" db:"events"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

type Grouper interface {
	Bucket(session Session) error
	GetGroup(fingerprint uint64) ExceptionGroup
}

// EventExists checks if the given event id exists in
// the ExceptionGroup's events array.
func (e ExceptionGroup) EventExists(id uuid.UUID) bool {
	return slices.ContainsFunc(e.Events, func(eventId uuid.UUID) bool {
		return eventId.String() == id.String()
	})
}

// AppendEventId appends a new event id to the ExceptionGroup's
// events array.
func (e ExceptionGroup) AppendEventId(id uuid.UUID) error {
	stmt := sqlf.PostgreSQL.Update("public.unhandled_exception_groups").
		SetExpr("events", "array_append(events, ?)", nil).
		Set("count", nil).
		Set("updated_at", nil)

	defer stmt.Close()
	_, err := server.Server.PgPool.Exec(context.Background(), stmt.String(), id, e.Count+1, time.Now())
	if err != nil {
		return err
	}

	return nil
}

// Match calculates the hamming distance between the
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

// FindMatch finds the index of the ExceptionGroup closest to
// an arbitrary fingerprint from a slice of ExceptionGroup.
func FindMatch(groups []ExceptionGroup, fingerprint uint64) (int, error) {
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
