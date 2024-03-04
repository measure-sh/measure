package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// AppExit represents app exit events
// suitable for session replay.
type AppExit struct {
	EventType string `json:"event_type"`
	*event.AppExit
	ThreadName string            `json:"-"`
	Attributes map[string]string `json:"attributes"`
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
// events for session replay.
func ComputeAppExits(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.AppExit.Trim()
		appExits := AppExit{
			event.Type,
			&event.AppExit,
			event.ThreadName,
			event.Attributes,
		}
		result = append(result, appExits)
	}

	return
}
