package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// NetworkChange represents network change events
// suitable for session replay.
type NetworkChange struct {
	EventType string `json:"event_type"`
	*event.NetworkChange
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where the network change took place.
func (nc NetworkChange) GetThreadName() string {
	return "main"
	// return nc.ThreadName
}

// GetTimestamp provides the timestamp of
// the network change event.
func (nc NetworkChange) GetTimestamp() time.Time {
	return nc.Timestamp
}

// Http represents http events
// suitable for session replay.
type Http struct {
	EventType string `json:"event_type"`
	*event.Http
	Duration  time.Duration `json:"duration"`
	Timestamp time.Time     `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where the http event took place.
func (h Http) GetThreadName() string {
	return "main"
	// return h.ThreadName
}

// GetTimestamp provides the timestamp of
// the http event.
func (h Http) GetTimestamp() time.Time {
	return h.Timestamp
}

// ComputeNetworkChange computes network change
// events for session replay.
func ComputeNetworkChange(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		netChanges := NetworkChange{
			event.Type,
			event.NetworkChange,
			event.Timestamp,
		}
		result = append(result, netChanges)
	}

	return
}

// ComputeHttp computes the http
// events for session replay.
func ComputeHttp(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		endTime := event.Http.EndTime
		startTime := event.Http.StartTime
		http := Http{
			event.Type,
			event.Http,
			time.Duration(endTime - startTime),
			event.Timestamp,
		}
		result = append(result, http)
	}

	return
}
