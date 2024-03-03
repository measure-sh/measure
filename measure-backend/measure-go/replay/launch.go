package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// ColdLaunch represents cold launch events
// suitable for session replay.
type ColdLaunch struct {
	*event.ColdLaunch
	ThreadName string            `json:"-"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where cold launch took place.
func (cl ColdLaunch) GetThreadName() string {
	return cl.ThreadName
}

// ComputeColdLaunches computes cold launch events
// for session replay.
func ComputeColdLaunches(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.ColdLaunch.Trim()
		coldLaunches := ColdLaunch{
			&event.ColdLaunch,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, coldLaunches)
	}

	return
}
