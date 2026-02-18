package measure

import (
	"backend/api/event"
	"slices"
	"time"

	"github.com/google/uuid"
)

// Session represents a session
type Session struct {
	SessionID uuid.UUID          `json:"session_id" binding:"required"`
	AppID     uuid.UUID          `json:"app_id"`
	Attribute *event.Attribute   `json:"attribute" binding:"required"`
	Events    []event.EventField `json:"events" binding:"required"`
}

// SessionDisplay provides a convinient
// wrapper over Session for display purposes.
type SessionDisplay struct {
	*Session
	FirstEventTime  *time.Time    `json:"first_event_time" binding:"required"`
	LastEventTime   *time.Time    `json:"last_event_time" binding:"required"`
	Duration        time.Duration `json:"duration"`
	MatchedFreeText string        `json:"matched_free_text"`
}

const (
	// sessionMinEvents is the minimum number of events
	// required for a session to be considered valid.
	sessionMinEvents = 3
)

// GetID returns the ID of session.
func (s Session) GetID() uuid.UUID {
	return s.SessionID
}

// hasEvents returns true if the session contains at least
// one event.
func (s *Session) hasEvents() bool {
	return len(s.Events) > 0
}

// firstEvent returns a pointer to the first event
// from the session's event slice.
func (s *Session) firstEvent() *event.EventField {
	if s.hasEvents() {
		return &s.Events[0]
	}
	return nil
}

// lastEvent returns a pointer to the last event
// from the session's event slice.
func (s *Session) lastEvent() *event.EventField {
	if s.hasEvents() {
		return &s.Events[len(s.Events)-1]
	}
	return nil
}

// EventsOfType retuns a slice of event.EventField that
// matches the accepted event type.
func (s *Session) EventsOfType(t string) (result []event.EventField) {
	for i := range s.Events {
		if s.Events[i].Type == t {
			result = append(result, s.Events[i])
		}
	}
	return
}

// EventsOfTypes provides events from the session
// matched by type.
func (s *Session) EventsOfTypes(types ...string) (result map[string][]event.EventField) {
	result = make(map[string][]event.EventField)
	for i := range s.Events {
		contains := slices.ContainsFunc(types, func(t string) bool {
			return t == s.Events[i].Type
		})
		if contains {
			result[s.Events[i].Type] = append(result[s.Events[i].Type], s.Events[i])
		}
	}
	return
}

// GetFirstEventTime provides the timestamp value of
// the first event of the session. Assumes session's
// event list is sorted ascending by timestamp.
//
// Returns zero time value if no events exist in the
// session.
func (s *Session) GetFirstEventTime() time.Time {
	if event := s.firstEvent(); event != nil {
		return event.Timestamp
	}

	return time.Time{}
}

// GetLastEventTime provides the timestamp value of
// the last event of the session. Assumes session's
// event list is sorted ascending by timestamp.
//
// Returns zero time value if no events exist in the
// session.
func (s *Session) GetLastEventTime() time.Time {
	if event := s.lastEvent(); event != nil {
		return event.Timestamp
	}

	return time.Time{}
}

// Duration calculates time duration between the last
// event and the first event in the session.
func (s Session) DurationFromEvents() time.Duration {
	return s.GetLastEventTime().Sub(s.GetFirstEventTime())
}
