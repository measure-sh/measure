package timeline

import (
	"context"
	"time"

	"backend/api/event"
	"backend/libs/udattr"

	"github.com/google/uuid"
)

// Exception represents exception events suitable
// for session timeline.
type Exception struct {
	EventType     string              `json:"event_type"`
	UDAttribute   *udattr.UDAttribute `json:"user_defined_attribute"`
	UserTriggered bool                `json:"user_triggered"`
	GroupId       string              `json:"group_id"`
	Severity      string              `json:"severity"`
	IsCustom      bool                `json:"is_custom"`
	NumCode       int32               `json:"num_code"`
	Code          string              `json:"code"`
	Meta          map[string]any      `json:"meta"`
	Type          string              `json:"type"`
	Message       string              `json:"message"`
	MethodName    string              `json:"method_name"`
	FileName      string              `json:"file_name"`
	LineNumber    int32               `json:"line_number"`
	ThreadName    string              `json:"thread_name"`
	Stacktrace    string              `json:"stacktrace"`
	Foreground    bool                `json:"foreground"`
	Error         *event.Error        `json:"error"`
	Timestamp     time.Time           `json:"timestamp"`
	Attachments   []event.Attachment  `json:"attachments"`
}

// GetThreadName provides the name of the thread
// where the exception event took place.
func (e Exception) GetThreadName() string {
	return e.ThreadName
}

// GetTimestamp provides the timestamp of
// the exception event.
func (e Exception) GetTimestamp() time.Time {
	return e.Timestamp
}

// ANR represents anr events suitable
// for session timeline.
type ANR struct {
	EventType   string              `json:"event_type"`
	Severity    string              `json:"severity"`
	UDAttribute *udattr.UDAttribute `json:"user_defined_attribute"`
	GroupId     string              `json:"group_id"`
	Type        string              `json:"type"`
	Message     string              `json:"message"`
	MethodName  string              `json:"method_name"`
	FileName    string              `json:"file_name"`
	LineNumber  int32               `json:"line_number"`
	ThreadName  string              `json:"thread_name"`
	Stacktrace  string              `json:"stacktrace"`
	Foreground  bool                `json:"foreground"`
	Timestamp   time.Time           `json:"timestamp"`
	Attachments []event.Attachment  `json:"attachments"`
}

// GetThreadName provides the name of the thread
// where the anr event took place.
func (a ANR) GetThreadName() string {
	return a.ThreadName
}

// GetTimestamp provides the timestamp of
// the anr event.
func (a ANR) GetTimestamp() time.Time {
	return a.Timestamp
}

// ComputeExceptions computes exceptions
// for session timeline.
func ComputeExceptions(ctx context.Context, appId *uuid.UUID, events []event.EventField) (result []ThreadGrouper, err error) {
	for _, e := range events {
		eventType := e.Type
		if eventType == event.TypeException {
			eventType = "error"
		}

		exceptions := Exception{
			eventType,
			&e.UserDefinedAttribute,
			e.UserTriggered,
			e.Exception.Fingerprint,
			e.Exception.GetSeverity().String(),
			e.Exception.IsCustom,
			e.Exception.NumCode,
			e.Exception.Code,
			e.Exception.Meta,
			e.Exception.GetType(),
			e.Exception.GetMessage(),
			e.Exception.GetMethodName(),
			e.Exception.GetFileName(),
			e.Exception.GetLineNumber(),
			e.Attribute.ThreadName,
			e.Exception.Stacktrace(),
			e.Exception.Foreground,
			e.Exception.Error,
			e.Timestamp,
			e.Attachments,
		}
		result = append(result, exceptions)
	}

	return result, nil
}

// ComputeANR computes anrs
// for session timeline.
func ComputeANRs(ctx context.Context, appId *uuid.UUID, events []event.EventField) (result []ThreadGrouper, err error) {
	for _, e := range events {
		anrs := ANR{
			e.Type,
			event.SeverityFatal.String(),
			&e.UserDefinedAttribute,
			e.ANR.Fingerprint,
			e.ANR.GetType(),
			e.ANR.GetMessage(),
			e.ANR.GetMethodName(),
			e.ANR.GetFileName(),
			e.ANR.GetLineNumber(),
			e.Attribute.ThreadName,
			e.ANR.Stacktrace(),
			e.ANR.Foreground,
			e.Timestamp,
			e.Attachments,
		}
		result = append(result, anrs)
	}

	return result, nil
}
