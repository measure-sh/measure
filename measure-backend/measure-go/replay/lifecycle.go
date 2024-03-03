package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// LifecycleActivity represents lifecycle
// activity events suitable for session replay.
type LifecycleActivity struct {
	*event.LifecycleActivity
	ThreadName string            `json:"-"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where lifecycle activity took place.
func (la LifecycleActivity) GetThreadName() string {
	return la.ThreadName
}

// ComputeLifecycleActivities computes lifecycle
// activity events for session replay.
func ComputeLifecycleActivities(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.LifecycleActivity.Trim()
		activities := LifecycleActivity{
			&event.LifecycleActivity,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, activities)
	}

	return
}
