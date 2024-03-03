package replay

import (
	"measure-backend/measure-go/event"
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
	*event.TrimMemory
	ThreadName string            `json:"-"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where trim memory event took place.
func (tm TrimMemory) GetThreadName() string {
	return tm.ThreadName
}

// ComputeMemoryUsage computes memory usage events
// for session replay.
func ComputeMemoryUsage(events []event.EventField) (result []MemoryUsage) {
	for _, event := range events {
		usage := MemoryUsage{
			&event.MemoryUsage,
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
		event.TrimMemory.Trim()
		memories := TrimMemory{
			&event.TrimMemory,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, memories)
	}

	return
}
