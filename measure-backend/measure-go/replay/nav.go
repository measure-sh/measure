package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// Navigation represents navigation events suitable
// for session replay.
type Navigation struct {
	EventType string `json:"event_type"`
	*event.Navigation
	ThreadName string            `json:"-"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where navigation took place.
func (n Navigation) GetThreadName() string {
	return n.ThreadName
}

// GetTimestamp provides the timestamp of
// the navigation event.
func (n Navigation) GetTimestamp() time.Time {
	return n.Timestamp
}

// ComputeNavigation computes navigation events
// for session replay.
func ComputeNavigation(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		navs := Navigation{
			event.Type,
			&event.Navigation,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, navs)
	}

	return
}
