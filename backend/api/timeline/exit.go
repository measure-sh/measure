package timeline

import (
	"backend/api/event"
	"time"
)

// AppExit represents app exit events
// suitable for session timeline.
type AppExit struct {
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	*event.AppExit
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where the app exit event took place.
func (ae AppExit) GetThreadName() string {
	return ae.ThreadName
}

// GetTimestamp provides the timestamp of
// the app exit event.
func (ae AppExit) GetTimestamp() time.Time {
	return ae.Timestamp
}

// ComputeAppExits computes app exit
// events for session timeline.
func ComputeAppExits(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		appExits := AppExit{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.AppExit,
			event.Timestamp,
		}
		result = append(result, appExits)
	}

	return
}
