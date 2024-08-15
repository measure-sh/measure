package replay

import (
	"backend/api/event"
	"time"
)

type CPUUsage struct {
	Time  time.Time `json:"timestamp"`
	Value float64   `json:"value"`
}

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
