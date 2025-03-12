package timeline

import (
	"backend/api/event"
	"time"

	"github.com/google/uuid"
)

// BugReport represents bug report events.
type BugReport struct {
	BugReportId uuid.UUID          `json:"bug_report_id"`
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	*event.BugReport
	Timestamp   time.Time          `json:"timestamp"`
	Attachments []event.Attachment `json:"attachments"`
}

// GetThreadName provides the name of the thread
// where the bug report event took place.
func (b BugReport) GetThreadName() string {
	return b.ThreadName
}

// GetTimestamp provides the timestamp of
// the bug report event.
func (b BugReport) GetTimestamp() time.Time {
	return b.Timestamp
}

// ComputeBugReport computes bug report events
// for session timeline.
func ComputeBugReport(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		navs := BugReport{
			event.ID,
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.BugReport,
			event.Timestamp,
			event.Attachments,
		}
		result = append(result, navs)
	}

	return
}
