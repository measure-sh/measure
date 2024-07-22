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
			Value: calculate(event.CPUUsage),
		}

		result = append(result, usage)
	}
	return
}

func calculate(u *event.CPUUsage) (usage float64) {
	// Sum the CPU times
	total := float64(u.UTime + u.STime + u.CUTime + u.CSTime)

	// Convert interval configuration from milliseconds to seconds
	elapsed := float64(u.IntervalConfig) / 1000

	// Divide total CPU time by the clock speed to get time in seconds
	usageTime := total / float64(u.ClockSpeed)

	// Divide by the elapsed time to get usage over the interval
	usageOverInterval := usageTime / elapsed

	// Divide by the number of cores to get the average usage per core
	averageUsage := (usageOverInterval / float64(u.NumCores)) * 100.0

	return averageUsage
}
