package timeline

import (
	"time"

	"backend/api/event"
	"backend/libs/udattr"
)

// Profile represents a profile event
// suitable for session timeline.
type Profile struct {
	EventType   string              `json:"event_type"`
	UDAttribute *udattr.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string              `json:"thread_name"`
	*event.Profile
	Timestamp   time.Time          `json:"timestamp"`
	Attachments []event.Attachment `json:"attachments"`
}

// GetThreadName provides the name of the thread
// where the profile was delivered.
func (pr Profile) GetThreadName() string {
	return pr.ThreadName
}

// GetTimestamp provides the timestamp of the
// profile event.
func (pr Profile) GetTimestamp() time.Time {
	return pr.Timestamp
}

// ComputeProfiles computes profile events
// for session timeline.
func ComputeProfiles(events []event.EventField) (result []ThreadGrouper) {
	for _, ev := range events {
		profile := Profile{
			ev.Type,
			&ev.UserDefinedAttribute,
			ev.Attribute.ThreadName,
			ev.Profile,
			ev.Timestamp,
			ev.Attachments,
		}
		result = append(result, profile)
	}

	return
}
