package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// NetworkChange represents network change events
// suitable for session replay.
type NetworkChange struct {
	*event.NetworkChange
	ThreadName string            `json:"-"`
	Timestmap  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where the network change took place.
func (nc NetworkChange) GetThreadName() string {
	return nc.ThreadName
}

// ComputeNetworkChange computes network change
// events for session replay.
func ComputeNetworkChange(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.NetworkChange.Trim()
		netChanges := NetworkChange{
			&event.NetworkChange,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, netChanges)
	}

	return
}
