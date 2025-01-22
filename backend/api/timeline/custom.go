package timeline

import (
	"backend/api/event"
	"time"
)

// Custom represents custom events.
type Custom struct {
	EventType     string             `json:"event_type"`
	UDAttribute   *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName    string             `json:"thread_name"`
	UserTriggered bool               `json:"user_triggered"`
	*event.Custom
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where the custom event took place.
func (c Custom) GetThreadName() string {
	return c.ThreadName
}

// GetTimestamp provides the timestamp of
// the custom event.
func (c Custom) GetTimestamp() time.Time {
	return c.Timestamp
}

// ComputeCustom computes custom events
// for session timeline.
func ComputeCustom(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		navs := Custom{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.UserTriggered,
			event.Custom,
			event.Timestamp,
		}
		result = append(result, navs)
	}

	return
}
