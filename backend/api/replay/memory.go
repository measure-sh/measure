package replay

import (
	"backend/api/event"
	"time"
)

// MemoryUsage represents memory usage
// events suitable for session replay.
type MemoryUsage struct {
	*event.MemoryUsage
	Timestamp time.Time `json:"timestamp"`
}

// TrimMemory represents trim memory events
// suitable for session replay.
type TrimMemory struct {
	EventType  string `json:"event_type"`
	ThreadName string `json:"thread_name"`
	*event.TrimMemory
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where trim memory event took place.
func (tm TrimMemory) GetThreadName() string {
	return tm.ThreadName
}

// GetTimestamp provides the timestamp of
// the trim memory event.
func (tm TrimMemory) GetTimestamp() time.Time {
	return tm.Timestamp
}

// LowMemory represents low memory events
// suitable for session replay.
type LowMemory struct {
	EventType  string `json:"event_type"`
	ThreadName string `json:"thread_name"`
	*event.LowMemory
	Timestamp time.Time `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where low memory event took place.
func (lm LowMemory) GetThreadName() string {
	return lm.ThreadName
}

// GetTimestamp provides the timestamp of
// the low memory event.
func (lm LowMemory) GetTimestamp() time.Time {
	return lm.Timestamp
}

// ComputeMemoryUsage computes memory usage events
// for session replay.
func ComputeMemoryUsage(events []event.EventField) (result []MemoryUsage) {
	for _, event := range events {
		usage := MemoryUsage{
			event.MemoryUsage,
			event.Timestamp,
		}

		result = append(result, usage)
	}
	return
}

// ComputeTrimMemories computes trim memory events
// for session replay.
func ComputeTrimMemories(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		memories := TrimMemory{
			event.Type,
			event.Attribute.ThreadName,
			event.TrimMemory,
			event.Timestamp,
		}
		result = append(result, memories)
	}

	return
}

// ComputeLowMemories computes low memory events
// for session replay.
func ComputeLowMemories(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		lowMemories := LowMemory{
			event.Type,
			event.Attribute.ThreadName,
			event.LowMemory,
			event.Timestamp,
		}
		result = append(result, lowMemories)
	}

	return
}
