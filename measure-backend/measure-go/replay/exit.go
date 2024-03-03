package replay

import (
	"measure-backend/measure-go/event"
)

// AppExit represents app exit events
// suitable for session replay.
type AppExit struct {
	*event.AppExit
	ThreadName string            `json:"-"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where the app exit event took place.
func (ae AppExit) GetThreadName() string {
	return ae.ThreadName
}

// ComputeAppExits computes app exit
// events for session replay.
func ComputeAppExits(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.AppExit.Trim()
		appExits := AppExit{
			&event.AppExit,
			event.ThreadName,
			event.Attributes,
		}
		result = append(result, appExits)
	}

	return
}
