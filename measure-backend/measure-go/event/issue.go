package event

import (
	"measure-backend/measure-go/chrono"

	"github.com/google/uuid"
)

type ThreadView struct {
	Name   string   `json:"name"`
	Frames []string `json:"frames"`
}

type EventANR struct {
	ID        uuid.UUID      `json:"id"`
	SessionID uuid.UUID      `json:"session_id"`
	Timestamp chrono.ISOTime `json:"timestamp"`
	Type      string         `json:"type"`
	Attribute Attribute      `json:"attribute"`
	ANR       ANR            `json:"-"`
	ANRView   ANRView        `json:"anr"`
	Threads   []ThreadView   `json:"threads"`
}

type ANRView struct {
	Title      string `json:"title"`
	Stacktrace string `json:"stacktrace"`
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
}

// ComputeView computes a consumer friendly
// version of the ANR.
func (e *EventANR) ComputeView() {
	e.ANRView = ANRView{
		Title:      e.ANR.GetTitle(),
		Stacktrace: e.ANR.Stacktrace(),
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
		Title:      e.Exception.GetTitle(),
		Stacktrace: e.Exception.Stacktrace(),
	}

	for i := range e.Exception.Threads {
		var tv ThreadView
		tv.Name = e.Exception.Threads[i].Name
		for j := range e.Exception.Threads[i].Frames {
			tv.Frames = append(tv.Frames, e.Exception.Threads[i].Frames[j].String())
		}
		e.Threads = append(e.Threads, tv)
	}
}
