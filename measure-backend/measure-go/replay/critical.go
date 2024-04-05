package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// Exception represents exception events suitable
// for session replay.
type Exception struct {
	EventType  string    `json:"event_type"`
	Type       string    `json:"type"`
	Handled    bool      `json:"handled"`
	Stacktrace string    `json:"stacktrace"`
	Foreground bool      `json:"foreground"`
	Timestamp  time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where the exception event took place.
func (e Exception) GetThreadName() string {
	return "main"
	// return e.ThreadName
}

// GetTimestamp provides the timestamp of
// the exception event.
func (e Exception) GetTimestamp() time.Time {
	return e.Timestamp
}

// ANR represents anr events suitable
// for session replay.
type ANR struct {
	EventType  string    `json:"event_type"`
	Type       string    `json:"type"`
	Stacktrace string    `json:"stacktrace"`
	Foreground bool      `json:"foreground"`
	Timestamp  time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where the anr event took place.
func (a ANR) GetThreadName() string {
	return "main"
	// return a.ThreadName
}

// GetTimestamp provides the timestamp of
// the anr event.
func (a ANR) GetTimestamp() time.Time {
	return a.Timestamp
}

// ComputeExceptions computes exceptions
// for session replay.
func ComputeExceptions(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		exceptions := Exception{
			event.Type,
			event.Exception.GetType(),
			event.Exception.Handled,
			event.Exception.Stacktrace(),
			event.Exception.Foreground,
			event.Timestamp,
		}
		result = append(result, exceptions)
	}

	return
}

// ComputeANR computes anrs
// for session replay.
func ComputeANRs(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		anrs := ANR{
			event.Type,
			event.ANR.GetType(),
			event.ANR.Stacktrace(),
			event.ANR.Foreground,
			event.Timestamp,
		}
		result = append(result, anrs)
	}

	return
}
