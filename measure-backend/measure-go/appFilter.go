package main

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// DefaultDuration is the time duration to
// set between the from and to time
const DefaultDuration = time.Hour * 24 * 7

// AppFilter validates and stores the request
// parameters to query the app's issue journey map,
// metrics, exceptions and ANRs
type AppFilter struct {
	// these fields should be exportable
	// otherwise gin doesn't bind them
	// and fails silently
	AppID   uuid.UUID
	From    time.Time `form:"from" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`
	To      time.Time `form:"to" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`
	Version string    `form:"version"`
}

// validate validates the app id, time range and
// version of the AppFilter
func (af *AppFilter) validate() error {
	// app UUID validations
	if af.AppID == uuid.Nil {
		return fmt.Errorf("app id is invalid or empty")
	}

	if af.AppID.Version().String() != "VERSION_4" {
		return fmt.Errorf("app id version is not UUID v4")
	}

	// time validations
	if af.To.Before(af.From) {
		return fmt.Errorf("`to` must be later time than `from`")
	}

	if af.From.After(time.Now().UTC()) {
		return fmt.Errorf("`from` cannot be later than now")
	}

	if af.From.IsZero() && !af.To.IsZero() {
		return fmt.Errorf("both `from` and `to` time must be set")
	}

	if af.To.IsZero() && !af.From.IsZero() {
		return fmt.Errorf("both `from` and `to` time must be set")
	}

	return nil
}

// hasVersion returns true if the request set
// a version otherwise false
func (af *AppFilter) hasVersion() bool {
	return af.Version != ""
}

// hasTimeRange return true if the request set
// a valid time range otherwise false
func (af *AppFilter) hasTimeRange() bool {
	return !af.From.IsZero() && !af.To.IsZero()
}

// setDefaultTimeRange sets the time range to last
// default duration from current UTC time
func (af *AppFilter) setDefaultTimeRange() {
	to := time.Now().UTC()
	from := to.Add(-DefaultDuration)

	af.From = from
	af.To = to
}

// setDefaultVersion sets the version to the
// latest app version if available
func (af *AppFilter) setDefaultVersion() {
	af.Version = "1.2.3"
}
