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
	ThreadName string            `json:"-"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where the network change took place.
func (nc NetworkChange) GetThreadName() string {
	return nc.ThreadName
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
	Duration   time.Duration     `json:"duration"`
	ThreadName string            `json:"-"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where the http event took place.
func (h Http) GetThreadName() string {
	return h.ThreadName
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
			&event.NetworkChange,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
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
			&event.Http,
			time.Duration(endTime - startTime),
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, http)
	}

	return
}
