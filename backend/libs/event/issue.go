package event

import (
	"bytes"
	"strings"
	"text/tabwriter"

	"backend/libs/artdump"
	"backend/libs/chrono"
	"backend/libs/udattr"

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
	Severity    Severity       `json:"severity"`
	Attachments []Attachment   `json:"attachments"`
	Threads     []ThreadView   `json:"threads"`
}

type ANRView struct {
	Title      string `json:"title"`
	Stacktrace string `json:"stacktrace"`
	Message    string `json:"message"`
	Subject    string `json:"subject"`
	// BlockingThread is the ART header of the thread the ANR is
	// blamed on, when that is not the main thread. It matches the
	// name of one of the threads below, and is empty when nothing
	// was holding the main thread up.
	BlockingThread string `json:"blocking_thread"`
}

type EventException struct {
	ID                   uuid.UUID          `json:"id"`
	SessionID            uuid.UUID          `json:"session_id"`
	Timestamp            chrono.ISOTime     `json:"timestamp"`
	Type                 string             `json:"type"`
	Attribute            Attribute          `json:"attribute"`
	Exception            Exception          `json:"-"`
	ExceptionView        ExceptionView      `json:"exception"`
	NumCode              *int32             `json:"num_code"`
	Code                 string             `json:"code"`
	Meta                 map[string]any     `json:"meta"`
	Severity             Severity           `json:"severity"`
	Attachments          []Attachment       `json:"attachments"`
	Threads              []ThreadView       `json:"threads"`
	UserDefinedAttribute udattr.UDAttribute `json:"user_defined_attribute"`
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
		Subject:    e.ANR.Subject,
	}

	if e.ANR.ThreadDump != nil {
		chain := e.ANR.blameChain()
		if blocking := rootBlockingThread(chain); blocking != nil {
			e.ANRView.BlockingThread = blocking.Header
		}
		e.Threads = threadDumpViews(e.ANR.ThreadDump, chain)
		return
	}

	e.Threads = []ThreadView{}

	for i := range e.ANR.Threads {
		tv := ThreadView{Name: e.ANR.Threads[i].Name, Frames: []string{}}
		for j := range e.ANR.Threads[i].Frames {
			tv.Frames = append(tv.Frames, e.ANR.Threads[i].Frames[j].String(FrameworkJVM))
		}
		e.Threads = append(e.Threads, tv)
	}
}

// threadDumpViews renders an ART thread dump into the thread shape the
// dashboard already draws. A thread is titled by its whole ART header,
// which carries the state and priority a bare name would lose, and a
// lock follows the frame it annotates.
//
// The top thread is left out. It is already rendered on its own from
// Stacktrace, and the detail page draws that above this list, so
// including it here would show the same thread twice.
//
// The stalled thread comes first among the rest, because when something
// else is blocking it the reader still wants its stack next. A dump
// carries dozens of threads and neither should have to be hunted for.
func threadDumpViews(dump *artdump.Dump, chain []*artdump.Thread) []ThreadView {
	holders := anrLockHolders(dump)
	main := dump.MainThread()

	top := main
	if blocking := rootBlockingThread(chain); blocking != nil {
		top = blocking
	}

	view := func(thread *artdump.Thread) ThreadView {
		return ThreadView{
			Name:   thread.Header,
			Frames: anrThreadStack(thread, holders),
		}
	}

	views := make([]ThreadView, 0, len(dump.Threads))
	if main != nil && main != top {
		views = append(views, view(main))
	}

	for i := range dump.Threads {
		thread := &dump.Threads[i]
		if thread == top || thread == main {
			continue
		}

		views = append(views, view(thread))
	}

	return views
}

// anrLockHolders maps an ART thread id to the thread's name, so a lock
// can name the thread holding it rather than a number. An unattached
// thread has no id and can never hold one.
func anrLockHolders(dump *artdump.Dump) map[int]string {
	holders := map[int]string{}
	for _, thread := range dump.Threads {
		if thread.Tid != 0 {
			holders[thread.Tid] = thread.Name
		}
	}

	return holders
}

// anrThreadStack renders a thread's frames, with each lock following the
// frame it annotates and naming the thread that holds it.
func anrThreadStack(thread *artdump.Thread, holders map[int]string) []string {
	var lines []string

	for _, frame := range thread.Frames {
		lines = append(lines, frame.Render())

		for _, lock := range frame.Locks {
			lines = append(lines, lock.Render(holders[lock.HolderTid]))
		}
	}

	return lines
}

// ComputeView computes a consumer friendly
// version of the exception.
func (e *EventException) ComputeView() {
	e.ExceptionView = ExceptionView{
		Title:      e.Exception.GetDisplayTitle(),
		Stacktrace: e.Exception.Stacktrace(),
		Message:    e.Exception.GetMessage(),
	}

	f := e.Exception.GetFramework()

	var buf bytes.Buffer
	w := &buf

	e.Threads = []ThreadView{}

	for i := range e.Exception.Threads {
		tv := ThreadView{Name: e.Exception.Threads[i].Name, Frames: []string{}}
		t := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)

		for j := range e.Exception.Threads[i].Frames {
			frame := e.Exception.Threads[i].Frames[j]
			switch f {
			default:
				tv.Frames = append(tv.Frames, frame.String(f))
			case FrameworkApple:
				t.Write(append([]byte(frame.String(f)), '\n'))

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
