package timeline

import (
	"backend/api/event"
	"time"
)

// LifecycleActivity represents lifecycle
// activity events suitable for session timeline.
type LifecycleActivity struct {
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	*event.LifecycleActivity
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where lifecycle activity took place.
func (la LifecycleActivity) GetThreadName() string {
	return la.ThreadName
}

// GetTimestamp provides the timestamp of
// the lifecycle activity event.
func (la LifecycleActivity) GetTimestamp() time.Time {
	return la.Timestamp
}

// LifecycleFragment represents lifecycle
// fragment events suitable for session timeline.
type LifecycleFragment struct {
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	*event.LifecycleFragment
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where lifecycle fragment event took place.
func (lf LifecycleFragment) GetThreadName() string {
	return lf.ThreadName
}

// GetTimestamp provides the timestamp of
// the lifecycle fragment event.
func (lf LifecycleFragment) GetTimestamp() time.Time {
	return lf.Timestamp
}

// LifecycleViewController represents lifecycle
// view controller events suitable for session timeline.
type LifecycleViewController struct {
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	*event.LifecycleViewController
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where lifecycle view controller event took place.
func (lvc LifecycleViewController) GetThreadName() string {
	return lvc.ThreadName
}

// GetTimestamp provides the timestamp of
// the lifecycle view controller event.
func (lvc LifecycleViewController) GetTimestamp() time.Time {
	return lvc.Timestamp
}

// LifecycleSwiftUI represents lifecycle swift ui view
// events suitable for session timeline.
type LifecycleSwiftUI struct {
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	*event.LifecycleSwiftUI
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where lifecycle swift ui view event took place.
func (lsu LifecycleSwiftUI) GetThreadName() string {
	return lsu.ThreadName
}

// GetTimestamp provides the timestamp of
// the lifecycle swift ui view event.
func (lsu LifecycleSwiftUI) GetTimestamp() time.Time {
	return lsu.Timestamp
}

// LifecycleApp represents lifecycle
// app events suitable for session timeline.
type LifecycleApp struct {
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	*event.LifecycleApp
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where lifecycle app event took place.
func (la LifecycleApp) GetThreadName() string {
	return la.ThreadName
}

// GetTimestamp provides the timestamp of
// the lifecycle app event.
func (la LifecycleApp) GetTimestamp() time.Time {
	return la.Timestamp
}

// ComputeLifecycleActivities computes lifecycle
// activity events for session timeline.
func ComputeLifecycleActivities(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		activities := LifecycleActivity{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.LifecycleActivity,
			event.Timestamp,
		}
		result = append(result, activities)
	}

	return
}

// ComputeLifecycleFragments computes lifecycle
// fragment events for session timeline.
func ComputeLifecycleFragments(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		fragments := LifecycleFragment{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.LifecycleFragment,
			event.Timestamp,
		}
		result = append(result, fragments)
	}

	return
}

// ComputeLifecycleViewControllers computes lifecycle
// view controller events for session timeline.
func ComputeLifecycleViewControllers(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		viewControllers := LifecycleViewController{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.LifecycleViewController,
			event.Timestamp,
		}
		result = append(result, viewControllers)
	}

	return
}

// ComputeLifecycleSwiftUIViews computes lifecycle
// swift UI views events for session timeline.
func ComputeLifecycleSwiftUIViews(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		swiftUIViews := LifecycleSwiftUI{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.LifecycleSwiftUI,
			event.Timestamp,
		}
		result = append(result, swiftUIViews)
	}

	return
}

// ComputeLifecycleApp computes lifecycle
// app events for session timeline.
func ComputeLifecycleApps(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		apps := LifecycleApp{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.LifecycleApp,
			event.Timestamp,
		}
		result = append(result, apps)
	}

	return
}
