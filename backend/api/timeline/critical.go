package timeline

import (
	"backend/api/event"
	"context"
	"time"

	"github.com/google/uuid"
)

// Exception represents exception events suitable
// for session timeline.
type Exception struct {
	EventType     string             `json:"event_type"`
	UDAttribute   *event.UDAttribute `json:"user_defined_attribute"`
	UserTriggered bool               `json:"user_triggered"`
	GroupId       string             `json:"group_id"`
	Type          string             `json:"type"`
	Message       string             `json:"message"`
	MethodName    string             `json:"method_name"`
	FileName      string             `json:"file_name"`
	LineNumber    int32              `json:"line_number"`
	ThreadName    string             `json:"thread_name"`
	Handled       bool               `json:"handled"`
	Stacktrace    string             `json:"stacktrace"`
	Foreground    bool               `json:"foreground"`
	Error         *event.Error       `json:"error"`
	Timestamp     time.Time          `json:"timestamp"`
	Attachments   []event.Attachment `json:"attachments"`
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
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	GroupId     string             `json:"group_id"`
	Type        string             `json:"type"`
	Message     string             `json:"message"`
	MethodName  string             `json:"method_name"`
	FileName    string             `json:"file_name"`
	LineNumber  int32              `json:"line_number"`
	ThreadName  string             `json:"thread_name"`
	Stacktrace  string             `json:"stacktrace"`
	Foreground  bool               `json:"foreground"`
	Timestamp   time.Time          `json:"timestamp"`
	Attachments []event.Attachment `json:"attachments"`
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
	for _, event := range events {
		exceptions := Exception{
			event.Type,
			&event.UserDefinedAttribute,
			event.UserTriggered,
			event.Exception.Fingerprint,
			event.Exception.GetType(),
			event.Exception.GetMessage(),
			event.Exception.GetMethodName(),
			event.Exception.GetFileName(),
			event.Exception.GetLineNumber(),
			event.Attribute.ThreadName,
			event.Exception.Handled,
			event.Exception.Stacktrace(),
			event.Exception.Foreground,
			event.Exception.Error,
			event.Timestamp,
			event.Attachments,
		}
		result = append(result, exceptions)
	}

	return result, nil
}

// ComputeANR computes anrs
// for session timeline.
func ComputeANRs(ctx context.Context, appId *uuid.UUID, events []event.EventField) (result []ThreadGrouper, err error) {
	for _, event := range events {
		anrs := ANR{
			event.Type,
			&event.UserDefinedAttribute,
			event.ANR.Fingerprint,
			event.ANR.GetType(),
			event.ANR.GetMessage(),
			event.ANR.GetMethodName(),
			event.ANR.GetFileName(),
			event.ANR.GetLineNumber(),
			event.Attribute.ThreadName,
			event.ANR.Stacktrace(),
			event.ANR.Foreground,
			event.Timestamp,
			event.Attachments,
		}
		result = append(result, anrs)
	}

	return result, nil
}
