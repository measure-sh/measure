package timeline

import (
	"backend/api/event"
	"time"
)

// NominalColdLaunchThreshold defines the upper bound
// of a nominal cold launch duration.
var NominalColdLaunchThreshold = 30 * time.Second

// ColdLaunch represents cold launch events
// suitable for session timeline.
type ColdLaunch struct {
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	Duration    time.Duration      `json:"duration"`
	Timestamp   time.Time          `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where cold launch took place.
func (cl ColdLaunch) GetThreadName() string {
	return cl.ThreadName
}

// GetTimestamp provides the timestamp of
// the cold launch event.
func (cl ColdLaunch) GetTimestamp() time.Time {
	return cl.Timestamp
}

// WarmLaunch represents warm launch events
// suitable for session timeline.
type WarmLaunch struct {
	EventType        string             `json:"event_type"`
	UDAttribute      *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName       string             `json:"thread_name"`
	Duration         time.Duration      `json:"duration"`
	LaunchedActivity string             `json:"launched_activity"`
	HasSavedState    bool               `json:"has_saved_state"`
	IntentData       string             `json:"intent_data"`
	Timestamp        time.Time          `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where warm launch took place.
func (wl WarmLaunch) GetThreadName() string {
	return wl.ThreadName
}

// GetTimestamp provides the timestamp of
// the warm launch event.
func (wl WarmLaunch) GetTimestamp() time.Time {
	return wl.Timestamp
}

// HotLaunch represents hot launch events
// suitable for session timeline.
type HotLaunch struct {
	EventType        string             `json:"event_type"`
	UDAttribute      *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName       string             `json:"thread_name"`
	Duration         time.Duration      `json:"duration"`
	LaunchedActivity string             `json:"launched_activity"`
	HasSavedState    bool               `json:"has_saved_state"`
	IntentData       string             `json:"intent_data"`
	Timestamp        time.Time          `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where hot launch took place.
func (hl HotLaunch) GetThreadName() string {
	return hl.ThreadName
}

// GetTimestamp provides the timestamp of
// the hot launch event.
func (hl HotLaunch) GetTimestamp() time.Time {
	return hl.Timestamp
}

// ComputeColdLaunches computes cold launch events
// for session timeline.
func ComputeColdLaunches(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		coldLaunches := ColdLaunch{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.ColdLaunch.Duration,
			event.Timestamp,
		}
		result = append(result, coldLaunches)
	}

	return
}

// ComputeWarmLaunches computes warm launch events
// for session timeline.
func ComputeWarmLaunches(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		warmLaunches := WarmLaunch{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.WarmLaunch.Duration,
			event.WarmLaunch.LaunchedActivity,
			event.WarmLaunch.HasSavedState,
			event.WarmLaunch.IntentData,
			event.Timestamp,
		}
		result = append(result, warmLaunches)
	}

	return
}

// ComputeHotLaunches computes hot launch events
// for session timeline.
func ComputeHotLaunches(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		hotLaunches := HotLaunch{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.HotLaunch.Duration,
			event.HotLaunch.LaunchedActivity,
			event.HotLaunch.HasSavedState,
			event.HotLaunch.IntentData,
			event.Timestamp,
		}
		result = append(result, hotLaunches)
	}

	return
}
