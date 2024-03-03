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
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where the click gesture took place.
func (gc GestureClick) GetThreadName() string {
	return gc.ThreadName
}

// GestureLongClick represents long press events
// suitable for session replay.
type GestureLongClick struct {
	*event.GestureLongClick
	ThreadName string            `json:"-"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where the long click gesture took place.
func (glc GestureLongClick) GetThreadName() string {
	return glc.ThreadName
}

// GestureScroll represents scroll gesture events
// suitable for session replay.
type GestureScroll struct {
	*event.GestureScroll
	ThreadName string            `json:"-"`
	Timestamp  time.Time         `json:"timestamp"`
	Attributes map[string]string `json:"attributes"`
}

// GetThreadName provides the name of the thread
// where the scroll gesture took place.
func (gs GestureScroll) GetThreadName() string {
	return gs.ThreadName
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

// ComputeGestureLongClicks computes long click gestures
// for session replay.
func ComputeGestureLongClicks(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.GestureLongClick.Trim()
		gestureLongClicks := GestureLongClick{
			&event.GestureLongClick,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, gestureLongClicks)
	}

	return
}

// ComputeGestureScrolls computes scroll gestures
// for session replay.
func ComputeGestureScrolls(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		event.GestureScroll.Trim()
		gestureScrolls := GestureScroll{
			&event.GestureScroll,
			event.ThreadName,
			event.Timestamp,
			event.Attributes,
		}
		result = append(result, gestureScrolls)
	}

	return
}
