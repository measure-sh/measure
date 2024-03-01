package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

type MemoryUsage struct {
	*event.MemoryUsage
	Timestamp time.Time `json:"timestamp"`
}

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
