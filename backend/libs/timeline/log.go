package timeline

import (
	"time"

	"backend/libs/event"
	"backend/libs/udattr"
)

// LogString represents log events suitable
// for session timeline.
type LogString struct {
	EventType   string              `json:"event_type"`
	UDAttribute *udattr.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string              `json:"thread_name"`
	*event.LogString
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where logging took place.
func (ls LogString) GetThreadName() string {
	return ls.ThreadName
}

// GetTimestamp provides the timestamp of
// the log event.
func (ls LogString) GetTimestamp() time.Time {
	return ls.Timestamp
}

// ComputeLogString computes logging events
// for session timeline.
func ComputeLogString(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		logs := LogString{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.LogString,
			event.Timestamp,
		}
		result = append(result, logs)
	}

	return
}

// Log represents log events suitable
// for session timeline.
type Log struct {
	EventType   string              `json:"event_type"`
	UDAttribute *udattr.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string              `json:"thread_name"`
	*event.Log
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where logging took place.
func (l Log) GetThreadName() string {
	return l.ThreadName
}

// GetTimestamp provides the timestamp of
// the log event.
func (l Log) GetTimestamp() time.Time {
	return l.Timestamp
}

// ComputeLogs computes logging events
// for session timeline.
func ComputeLogs(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		logs := Log{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.Log,
			event.Timestamp,
		}
		result = append(result, logs)
	}

	return
}
