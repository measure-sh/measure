package timeline

import (
	"context"
	"time"

	"backend/libs/event"
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
	ThreadDump  string              `json:"thread_dump"`
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
			EventType:     eventType,
			UDAttribute:   &e.UserDefinedAttribute,
			UserTriggered: e.UserTriggered,
			GroupId:       e.Exception.Fingerprint,
			Severity:      e.Exception.GetSeverity().String(),
			IsCustom:      e.Exception.IsCustom,
			NumCode:       e.Exception.NumCode,
			Code:          e.Exception.Code,
			Meta:          e.Exception.Meta,
			Type:          e.Exception.GetType(),
			Message:       e.Exception.GetMessage(),
			MethodName:    e.Exception.GetMethodName(),
			FileName:      e.Exception.GetFileName(),
			LineNumber:    e.Exception.GetLineNumber(),
			ThreadName:    e.Attribute.ThreadName,
			Stacktrace:    e.Exception.Stacktrace(),
			Foreground:    e.Exception.Foreground,
			Error:         e.Exception.Error,
			Timestamp:     e.Timestamp,
			Attachments:   e.Attachments,
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
			EventType:   e.Type,
			Severity:    event.SeverityFatal.String(),
			UDAttribute: &e.UserDefinedAttribute,
			GroupId:     e.ANR.Fingerprint,
			Type:        e.ANR.GetType(),
			Message:     e.ANR.GetMessage(),
			MethodName:  e.ANR.GetMethodName(),
			FileName:    e.ANR.GetFileName(),
			LineNumber:  e.ANR.GetLineNumber(),
			ThreadName:  e.Attribute.ThreadName,
			Stacktrace:  e.ANR.Stacktrace(),
			ThreadDump:  e.ANR.ThreadDump,
			Foreground:  e.ANR.Foreground,
			Timestamp:   e.Timestamp,
			Attachments: e.Attachments,
		}
		result = append(result, anrs)
	}

	return result, nil
}
