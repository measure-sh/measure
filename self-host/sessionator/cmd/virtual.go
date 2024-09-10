package cmd

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// virtualizer provides settings
// for virtualizing event ingestion.
type virtualizer struct {
	virtualEvents   bool
	virtualSessions bool
	sessionIdMap    map[string]uuid.UUID
}

// NewVirtualizer creates a new virtualizer.
func NewVirtualizer() *virtualizer {
	return &virtualizer{
		virtualEvents:   false,
		virtualSessions: false,
		sessionIdMap:    make(map[string]uuid.UUID),
	}
}

// doubleQuoteID wraps a UUID in double
// quotes.
func doubleQuoteID(id uuid.UUID) string {
	return "\"" + id.String() + "\""
}

// rawEvent replaces the raw json event's
// id.
func rawEventId(rm *json.RawMessage) (err error) {
	id := uuid.New()
	quotedId := doubleQuoteID(id)
	opts := sjson.Options{
		Optimistic:     true,
		ReplaceInPlace: true,
	}
	_, err = sjson.SetRawBytesOptions(*rm, "id", []byte(quotedId), &opts)

	return
}

// rawEvent replaces the raw json session's
// id.
func rawSessionId(v *virtualizer, rm *json.RawMessage) (err error) {
	result := gjson.GetBytes(*rm, "session_id")

	opts := sjson.Options{
		Optimistic:     true,
		ReplaceInPlace: true,
	}

	sessionId, ok := v.sessionIdMap[result.Str]
	if !ok {
		id := uuid.New()
		v.sessionIdMap[result.Str] = id
		quotedId := doubleQuoteID(id)
		_, err = sjson.SetRawBytesOptions(*rm, "id", []byte(quotedId), &opts)
		return
	}

	quotedId := doubleQuoteID(sessionId)
	_, err = sjson.SetRawBytesOptions(*rm, "id", []byte(quotedId), &opts)

	return
}

// Event enables virtualization of events.
func (v *virtualizer) Event() *virtualizer {
	v.virtualEvents = true
	return v
}

// Event enables virtualization of sessions.
func (v *virtualizer) Session() *virtualizer {
	v.virtualSessions = true
	return v
}

// Virtualize virtualizes a single json raw event.
func (v *virtualizer) Virtualize(rm *json.RawMessage) (err error) {
	if v.virtualEvents {
		if err = rawEventId(rm); err != nil {
			return
		}
	}

	if v.virtualSessions {
		if err = rawSessionId(v, rm); err != nil {
			return
		}
	}

	return
}
