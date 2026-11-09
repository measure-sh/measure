package measure

import (
	"time"

	"backend/libs/event"
	"backend/libs/udattr"

	"github.com/google/uuid"
)

// BugReport represents a session
type BugReport struct {
	SessionID            uuid.UUID          `json:"session_id" binding:"required"`
	AppID                uuid.UUID          `json:"app_id" binding:"required"`
	EventID              uuid.UUID          `json:"event_id" binding:"required"`
	Status               uint8              `json:"status" binding:"required"`
	Description          string             `json:"description" binding:"required"`
	Timestamp            *time.Time         `json:"timestamp" binding:"required"`
	UpdatedAt            *time.Time         `json:"updated_at" binding:"required"`
	Attribute            *event.Attribute   `json:"attribute" binding:"required"`
	UserDefinedAttribute udattr.UDAttribute `json:"user_defined_attribute" binding:"required"`
	Attachments          []event.Attachment `json:"attachments" binding:"required"`
}

// BugReportDetail represents a bug report and whether its session has a
// replay.
type BugReportDetail struct {
	BugReport
	HasReplay bool `json:"has_replay"`
}

// BugReportInstance represents an entity
// for plotting bug report instances.
type BugReportInstance struct {
	DateTime  string  `json:"datetime"`
	Version   string  `json:"version"`
	Instances *uint64 `json:"instances"`
}

type BugReportStatusUpdatePayload struct {
	// Status represents the status of the bug report.
	//
	// - 0 (open)
	// - 1 (closed)
	//
	// pointer differentiates between 0 and nil, to validate
	// non-existant status.
	Status *uint8 `json:"status" binding:"required"`
}
