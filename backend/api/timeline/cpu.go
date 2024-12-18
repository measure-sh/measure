package timeline

import (
	"backend/api/event"
	"time"
)

// CPUUsage represents cpu usage
// events suitable for session timeline.
type CPUUsage struct {
	Time  time.Time `json:"timestamp"`
	Value float64   `json:"value"`
}

// ComputeCPUUsage computes cpu usage
// events for session timeline.
func ComputeCPUUsage(events []event.EventField) (result []CPUUsage) {
	for _, event := range events {
		usage := CPUUsage{
			Time:  event.Timestamp,
			Value: event.CPUUsage.PercentageUsage,
		}

		result = append(result, usage)
	}
	return
}
