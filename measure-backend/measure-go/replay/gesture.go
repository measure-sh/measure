package replay

import (
	"measure-backend/measure-go/event"
	"time"
)

// GestureClick represents click events suitable
// for session replay.
type GestureClick struct {
	*event.GestureClick
	ThreadName string            `json:"-"`
	Timestmap  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where the click gesture took place.
func (gc GestureClick) GetThreadName() string {
	return gc.ThreadName
}

// ComputeGestureClicks computes click gestures
// for session replay.
func ComputeGestureClicks(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.GestureClick.Trim()
		gestureClicks := GestureClick{
			&event.GestureClick,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, gestureClicks)
	}

	return
}

