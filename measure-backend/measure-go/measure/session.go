package measure

import (
	"measure-backend/measure-go/event"
	"slices"
	"time"

	"github.com/google/uuid"
)

type Session struct {
	SessionID uuid.UUID          `json:"session_id" binding:"required"`
	AppID     uuid.UUID          `json:"app_id"`
	Attribute *event.Attribute   `json:"attribute" binding:"required"`
	Events    []event.EventField `json:"events" binding:"required"`
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

func (s Session) Duration() time.Duration {
	return s.GetLastEventTime().Sub(s.GetFirstEventTime())
}

func (s *Session) hasEvents() bool {
	return len(s.Events) > 0
}
