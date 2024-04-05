package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// LifecycleActivity represents lifecycle
// activity events suitable for session replay.
type LifecycleActivity struct {
	EventType string `json:"event_type"`
	*event.LifecycleActivity
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where lifecycle activity took place.
func (la LifecycleActivity) GetThreadName() string {
	return "main"
	// return la.ThreadName
}

// GetTimestamp provides the timestamp of
// the lifecycle activity event.
func (la LifecycleActivity) GetTimestamp() time.Time {
	return la.Timestamp
}

// LifecycleFragment represents lifecycle
// fragment events suitable for session replay.
type LifecycleFragment struct {
	EventType string `json:"event_type"`
	*event.LifecycleFragment
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where lifecycle fragment event took place.
func (lf LifecycleFragment) GetThreadName() string {
	return "main"
	// return lf.ThreadName
}

// GetTimestamp provides the timestamp of
// the lifecycle fragment event.
func (lf LifecycleFragment) GetTimestamp() time.Time {
	return lf.Timestamp
}

// LifecycleApp represents lifecycle
// app events suitable for session replay.
type LifecycleApp struct {
	EventType string `json:"event_type"`
	*event.LifecycleApp
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where lifecycle app event took place.
func (la LifecycleApp) GetThreadName() string {
	return "main"
	// return la.ThreadName
}

// GetTimestamp provides the timestamp of
// the lifecycle app event.
func (la LifecycleApp) GetTimestamp() time.Time {
	return la.Timestamp
}

// ComputeLifecycleActivities computes lifecycle
// activity events for session replay.
func ComputeLifecycleActivities(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		activities := LifecycleActivity{
			event.Type,
			event.LifecycleActivity,
			event.Timestamp,
		}
		result = append(result, activities)
	}

	return
}

// ComputeLifecycleFragments computes lifecycle
// fragment events for session replay.
func ComputeLifecycleFragments(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		fragments := LifecycleFragment{
			event.Type,
			event.LifecycleFragment,
			event.Timestamp,
		}
		result = append(result, fragments)
	}

	return
}

// ComputeLifecycleApp computes lifecycle
// app events for session replay.
func ComputeLifecycleApps(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		apps := LifecycleApp{
			event.Type,
			event.LifecycleApp,
			event.Timestamp,
		}
		result = append(result, apps)
	}

	return
}
