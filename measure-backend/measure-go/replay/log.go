package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// LogString represents log events suitable
// for session replay.
type LogString struct {
	EventType string `json:"event_type"`
	*event.LogString
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where logging took place.
func (ls LogString) GetThreadName() string {
	return "main"
	// return ls.ThreadName
}

// GetTimestamp provides the timestamp of
// the log event.
func (ls LogString) GetTimestamp() time.Time {
	return ls.Timestamp
}

// ComputeLogString computes logging events
// for session replay.
func ComputeLogString(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		logs := LogString{
			event.Type,
			event.LogString,
			event.Timestamp,
		}
		result = append(result, logs)
	}

	return
}
