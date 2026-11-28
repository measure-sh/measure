package timeline

import (
	"time"

	"backend/libs/event"
	"backend/libs/udattr"
)

// ScreenView represents screen view events suitable
// for session timeline.
type ScreenView struct {
	EventType     string              `json:"event_type"`
	UDAttribute   *udattr.UDAttribute `json:"user_defined_attribute"`
	ThreadName    string              `json:"thread_name"`
	UserTriggered bool                `json:"user_triggered"`
	*event.ScreenView
	Timestamp   time.Time          `json:"timestamp"`
	Attachments []event.Attachment `json:"attachments"`
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
			event.Attachments,
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
