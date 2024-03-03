package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// LogString represents log events suitable
// for session replay.
type LogString struct {
	*event.LogString
	ThreadName string            `json:"-"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where logging took place.
func (ls LogString) GetThreadName() string {
	return ls.ThreadName
}

// ComputeLogString computes logging events
// for session replay.
func ComputeLogString(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.LogString.Trim()
		logs := LogString{
			&event.LogString,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, logs)
	}

	return
}
