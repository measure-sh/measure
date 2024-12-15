package timeline

import (
	"backend/api/event"
	"time"
)

// GestureClick represents click events suitable
// for session timeline.
type GestureClick struct {
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	Target      string             `json:"target"`
	TargetID    string             `json:"target_id"`
	Width       uint16             `json:"width"`
	Height      uint16             `json:"height"`
	X           float32            `json:"x"`
	Y           float32            `json:"y"`
	Timestamp   time.Time          `json:"timestamp"`
	Attachments []event.Attachment `json:"attachments"`
}

// GetThreadName provides the name of the thread
// where the click gesture took place.
func (gc GestureClick) GetThreadName() string {
	return gc.ThreadName
}

// GetTimestamp provides the timestamp of
// the gesture click event.
func (gc GestureClick) GetTimestamp() time.Time {
	return gc.Timestamp
}

// GestureLongClick represents long press events
// suitable for session timeline.
type GestureLongClick struct {
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	Target      string             `json:"target"`
	TargetID    string             `json:"target_id"`
	Width       uint16             `json:"width"`
	Height      uint16             `json:"height"`
	X           float32            `json:"x"`
	Y           float32            `json:"y"`
	Timestamp   time.Time          `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where the long click gesture took place.
func (glc GestureLongClick) GetThreadName() string {
	return glc.ThreadName
}

// GetTimestamp provides the timestamp of
// the gesture long click event.
func (glc GestureLongClick) GetTimestamp() time.Time {
	return glc.Timestamp
}

// GestureScroll represents scroll gesture events
// suitable for session timeline.
type GestureScroll struct {
	EventType   string             `json:"event_type"`
	UDAttribute *event.UDAttribute `json:"user_defined_attribute"`
	ThreadName  string             `json:"thread_name"`
	Target      string             `json:"target"`
	TargetID    string             `json:"target_id"`
	X           float32            `json:"x"`
	Y           float32            `json:"y"`
	EndX        float32            `json:"end_x"`
	EndY        float32            `json:"end_y"`
	Direction   string             `json:"direction"`
	Timestamp   time.Time          `json:"timestamp"`
}

// GetThreadName provides the name of the thread
// where the scroll gesture took place.
func (gs GestureScroll) GetThreadName() string {
	return gs.ThreadName
}

// GetTimestamp provides the timestamp of
// the gesture scroll event.
func (gs GestureScroll) GetTimestamp() time.Time {
	return gs.Timestamp
}

// ComputeGestureClicks computes click gestures
// for session timeline.
func ComputeGestureClicks(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		gestureClicks := GestureClick{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.GestureClick.Target,
			event.GestureClick.TargetID,
			event.GestureClick.Width,
			event.GestureClick.Height,
			event.GestureClick.X,
			event.GestureClick.Y,
			event.Timestamp,
			event.Attachments,
		}
		result = append(result, gestureClicks)
	}

	return
}

// ComputeGestureLongClicks computes long click gestures
// for session timeline.
func ComputeGestureLongClicks(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		gestureLongClicks := GestureLongClick{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.GestureLongClick.Target,
			event.GestureLongClick.TargetID,
			event.GestureLongClick.Width,
			event.GestureLongClick.Height,
			event.GestureLongClick.X,
			event.GestureLongClick.Y,
			event.Timestamp,
		}
		result = append(result, gestureLongClicks)
	}

	return
}

// ComputeGestureScrolls computes scroll gestures
// for session timeline.
func ComputeGestureScrolls(events []event.EventField) (result []ThreadGrouper) {
	for _, event := range events {
		gestureScrolls := GestureScroll{
			event.Type,
			&event.UserDefinedAttribute,
			event.Attribute.ThreadName,
			event.GestureScroll.Target,
			event.GestureScroll.TargetID,
			event.GestureScroll.X,
			event.GestureScroll.Y,
			event.GestureScroll.EndX,
			event.GestureScroll.EndY,
			event.GestureScroll.Direction,
			event.Timestamp,
		}
		result = append(result, gestureScrolls)
	}

	return
}
