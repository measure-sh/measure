package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// AndroidxNavigation represents androidx navigation events suitable
// for session replay.
type AndroidxNavigation struct {
	EventType  string `json:"event_type"`
	ThreadName string `json:"thread_name"`
	*event.AndroidxNavigation
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where navigation took place.
func (n AndroidxNavigation) GetThreadName() string {
	return n.ThreadName
}

// GetTimestamp provides the timestamp of
// the androidx navigation event.
func (n AndroidxNavigation) GetTimestamp() time.Time {
	return n.Timestamp
}

// ComputeAndroidxNavigation computes androidx navigation events
// for session replay.
func ComputeAndroidxNavigation(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		navs := AndroidxNavigation{
			event.Type,
			event.Attribute.ThreadName,
			event.AndroidxNavigation,
			event.Timestamp,
		}
		result = append(result, navs)
	}

	return
}
