package timeline

import (
	"backend/api/event"
	"time"
)

// Navigation represents navigation events suitable
// for session timeline.
type Navigation struct {
	EventType     string             `json:"event_type"`
	UDAttribute   *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName    string             `json:"thread_name"`
	UserTriggered bool               `json:"user_triggered"`
	*event.Navigation
	Timestamp time.Time `json:"timestamp"`
}

// ScreenView represents screen view events suitable
// for session timeline.
type ScreenView struct {
	EventType     string             `json:"event_type"`
	UDAttribute   *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName    string             `json:"thread_name"`
	UserTriggered bool               `json:"user_triggered"`
	*event.ScreenView
	Timestamp time.Time `json:"timestamp"`
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
// for session timeline.
func ComputeNavigation(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		navs := Navigation{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.UserTriggered,
			event.Navigation,
			event.Timestamp,
		}
		result = append(result, navs)
	}

	return
}

// ComputeScreemViews computes screen view events
// for session timeline.
func ComputeScreenViews(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		sv := ScreenView{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.UserTriggered,
			event.ScreenView,
			event.Timestamp,
		}
		result = append(result, sv)
	}

	return
}

// GetThreadName provides the name of the thread
// where screen view took place.
func (sv ScreenView) GetThreadName() string {
	return sv.ThreadName
}

// GetTimestamp provides the timestamp of
// the screen view.
func (sv ScreenView) GetTimestamp() time.Time {
	return sv.Timestamp
}
