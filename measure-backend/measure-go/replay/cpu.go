package replay

import (
	"measure-backend/measure-go/event"
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
			Value: calculate(&event.CPUUsage),
		}

		result = append(result, usage)
	}
	return
}

func calculate(u *event.CPUUsage) (usage float64) {
	total := float64(u.UTime + u.STime + u.CUTime + u.CSTime)
	elapsed := float64(u.IntervalConfig) / 1000

	return (total / float64(u.ClockSpeed)) / (elapsed * float64(u.NumCores)) * 100.0
}
