package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// Exception represents exception events suitable
// for session replay.
type Exception struct {
	// *event.Exception
	Type              string            `json:"type"`
	Location          string            `json:"location"`
	Message           string            `json:"message"`
	ThreadName        string            `json:"thread_name"`
	Handled           bool              `json:"handled"`
	NetworkType       string            `json:"network_type"`
	NetworkProvider   string            `json:"network_provider"`
	NetworkGeneration string            `json:"network_generation"`
	DeviceLocale      string            `json:"device_locale"`
	Timestamp         time.Time         `json:"timestamp"`
	Attributes        map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where the exception event took place.
func (e Exception) GetThreadName() string {
	return e.ThreadName
}

// ComputeExceptions computes exceptions
// for session replay.
func ComputeExceptions(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.Exception.Trim()
		exceptions := Exception{
			event.Exception.GetType(),
			event.Exception.GetLocation(),
			event.Exception.GetMessage(),
			event.Exception.ThreadName,
			event.Exception.Handled,
			event.Exception.NetworkType,
			event.Exception.NetworkProvider,
			event.Exception.NetworkGeneration,
			event.Exception.DeviceLocale,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, exceptions)
	}

	return
}
