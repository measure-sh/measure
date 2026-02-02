package measure

import (
	"backend/api/event"
	"fmt"
	"strings"
	"time"

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
	UserDefinedAttribute event.UDAttribute  `json:"user_defined_attribute" binding:"required"`
	Attachments          []event.Attachment `json:"attachments" binding:"required"`
}

// BugReportDisplay provides a convenient
// wrapper over BugReport for display purposes.
type BugReportDisplay struct {
	*BugReport
	MatchedFreeText string `json:"matched_free_text"`
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
	// - 0 (closed)
	// - 1 (open)
	//
	// pointer differentiates between 0 and nil, to validate
	// non-existant status.
	Status *uint8 `json:"status" binding:"required"`
}

// ExtractMatches extracts matching text from
// bug report's various fields.
func extractMatches(needle, userId, eventId, sessionId, description string) (matched string) {
	if needle == "" {
		return
	}

	buff := []string{}

	// user id
	if strings.Contains(strings.ToLower(userId), strings.ToLower(needle)) {
		buff = append(buff, fmt.Sprintf("User Id: %s", userId))
	}

	// event id
	if strings.Contains(strings.ToLower(eventId), strings.ToLower(needle)) {
		buff = append(buff, fmt.Sprintf("Bug Report Id: %s", eventId))
	}

	// session id
	if strings.Contains(strings.ToLower(sessionId), strings.ToLower(needle)) {
		buff = append(buff, fmt.Sprintf("Session Id: %s", sessionId))
	}

	// description
	if strings.Contains(strings.ToLower(description), strings.ToLower(needle)) {
		buff = append(buff, fmt.Sprintf("Description: %s", description))
	}

	matched = strings.Join(buff, " ")

	return
}
