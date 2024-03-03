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

// LifecycleFragment represents lifecycle
// fragment events suitable for session replay.
type LifecycleFragment struct {
	*event.LifecycleFragment
	ThreadName string            `json:"-"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where lifecycle fragment event took place.
func (lf LifecycleFragment) GetThreadName() string {
	return lf.ThreadName
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

// ComputeLifecycleFragments computes lifecycle
// fragment events for session replay.
func ComputeLifecycleFragments(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.LifecycleFragment.Trim()
		fragments := LifecycleFragment{
			&event.LifecycleFragment,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, fragments)
	}

	return
}
