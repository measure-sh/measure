package event

import (
	"backend/api/chrono"
	"backend/api/platform"
	"bytes"
	"strings"
	"text/tabwriter"

	"github.com/google/uuid"
)

type ThreadView struct {
	Name   string   `json:"name"`
	Frames []string `json:"frames"`
}

type EventANR struct {
	ID          uuid.UUID      `json:"id"`
	SessionID   uuid.UUID      `json:"session_id"`
	Timestamp   chrono.ISOTime `json:"timestamp"`
	Type        string         `json:"type"`
	Attribute   Attribute      `json:"attribute"`
	ANR         ANR            `json:"-"`
	ANRView     ANRView        `json:"anr"`
	Attachments []Attachment   `json:"attachments"`
	Threads     []ThreadView   `json:"threads"`
}

type ANRView struct {
	Title      string `json:"title"`
	Stacktrace string `json:"stacktrace"`
	Message    string `json:"message"`
}

type EventException struct {
	ID            uuid.UUID      `json:"id"`
	SessionID     uuid.UUID      `json:"session_id"`
	Timestamp     chrono.ISOTime `json:"timestamp"`
	Type          string         `json:"type"`
	Attribute     Attribute      `json:"attribute"`
	Exception     Exception      `json:"-"`
	ExceptionView ExceptionView  `json:"exception"`
	Attachments   []Attachment   `json:"attachments"`
	Threads       []ThreadView   `json:"threads"`
}

type ExceptionView struct {
	Title      string `json:"title"`
	Stacktrace string `json:"stacktrace"`
	Message    string `json:"message"`
}

// ComputeView computes a consumer friendly
// version of the ANR.
func (e *EventANR) ComputeView() {
	e.ANRView = ANRView{
		Title:      e.ANR.GetDisplayTitle(),
		Stacktrace: e.ANR.Stacktrace(),
		Message:    e.ANR.GetMessage(),
	}

	for i := range e.ANR.Threads {
		var tv ThreadView
		tv.Name = e.ANR.Threads[i].Name
		for j := range e.ANR.Threads[i].Frames {
			tv.Frames = append(tv.Frames, e.ANR.Threads[i].Frames[j].String())
		}
		e.Threads = append(e.Threads, tv)
	}
}

// ComputeView computes a consumer friendly
// version of the exception.
func (e *EventException) ComputeView() {
	e.ExceptionView = ExceptionView{
		Title:      e.Exception.GetDisplayTitle(),
		Stacktrace: e.Exception.Stacktrace(),
		Message:    e.Exception.GetMessage(),
	}

	var buf bytes.Buffer
	w := &buf

	for i := range e.Exception.Threads {
		var tv ThreadView
		t := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
		tv.Name = e.Exception.Threads[i].Name

		for j := range e.Exception.Threads[i].Frames {
			frame := e.Exception.Threads[i].Frames[j]
			switch frame.GetPlatform() {
			default:
				tv.Frames = append(tv.Frames, frame.String())
			case platform.IOS:
				t.Write(append([]byte(frame.String()), '\n'))

				// flush on last frame
				if j == len(e.Exception.Threads[i].Frames)-1 {
					t.Flush()
					tv.Frames = strings.Split(buf.String(), "\n")
				}
			}
		}
		e.Threads = append(e.Threads, tv)
		w.Reset()
	}
}
