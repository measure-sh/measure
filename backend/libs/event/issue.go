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
	// Cause is read from the thread dump, empty for an ANR that carries
	// no thread dump.
	Cause string `json:"cause"`
	// BlamedThread is the ART header of the thread Stacktrace was taken
	// from, empty for an ANR that carries no thread dump.
	BlamedThread string `json:"blamed_thread"`
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
	Title       string           `json:"title"`
	Stacktrace  string           `json:"stacktrace"`
	Message     string           `json:"message"`
	Cause       string           `json:"cause"`
	MemoryError *MemoryErrorView `json:"memory_error"`
}

// MemoryErrorView is a memory error with its
// stacks as text lines.
type MemoryErrorView struct {
	Tool         string                `json:"tool"`
	Type         string                `json:"type"`
	Address      string                `json:"address"`
	Size         uint64                `json:"size"`
	Deallocation *MemoryErrorStackView `json:"deallocation"`
	Allocation   *MemoryErrorStackView `json:"allocation"`
}

type MemoryErrorStackView struct {
	ThreadID   uint64   `json:"thread_id"`
	ThreadName string   `json:"thread_name"`
	Frames     []string `json:"frames"`
}

type EventAppHang struct {
	ID          uuid.UUID      `json:"id"`
	SessionID   uuid.UUID      `json:"session_id"`
	Timestamp   chrono.ISOTime `json:"timestamp"`
	Type        string         `json:"type"`
	Attribute   Attribute      `json:"attribute"`
	AppHang     AppHang        `json:"-"`
	AppHangView AppHangView    `json:"app_hang"`
	Attachments []Attachment   `json:"attachments"`
	Threads     []ThreadView   `json:"threads"`
}

type AppHangView struct {
	Title      string `json:"title"`
	Stacktrace string `json:"stacktrace"`
	ThreadName string `json:"thread_name"`
	Duration   uint32 `json:"duration"`
	State      string `json:"state"`
}

// ComputeView computes a consumer friendly
// version of the app hang.
func (e *EventAppHang) ComputeView() {
	e.AppHangView = AppHangView{
		Title:      e.AppHang.GetDisplayTitle(),
		Stacktrace: e.AppHang.Stacktrace(),
		ThreadName: e.AppHang.GetThreadName(),
		Duration:   e.AppHang.Duration,
		State:      e.AppHang.State,
	}
	e.Threads = []ThreadView{}
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
		e.ANRView.Cause = e.ANR.ThreadDump.Cause

		// Ingest sorts the thread the ANR is blamed on first, and the
		// stacktrace already shows it.
		threads := e.ANR.ThreadDump.Threads
		e.Threads = []ThreadView{}
		if len(threads) > 0 {
			e.ANRView.BlamedThread = threads[0].Header
			e.Threads = threadViews(threads[1:])
		}
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

// threadViews renders ART threads into the thread shape the dashboard
// already draws.
func threadViews(threads []artdump.Thread) []ThreadView {
	views := make([]ThreadView, 0, len(threads))
	for _, thread := range threads {
		views = append(views, ThreadView{
			Name:   thread.Header,
			Frames: thread.RenderStack(),
		})
	}

	return views
}

// ComputeView computes a consumer friendly
// version of the exception.
func (e *EventException) ComputeView() {
	e.ExceptionView = ExceptionView{
		Title:       e.Exception.GetDisplayTitle(),
		Stacktrace:  e.Exception.Stacktrace(),
		Message:     e.Exception.GetMessage(),
		Cause:       e.Exception.Cause,
		MemoryError: memoryErrorView(e.Exception.MemoryError),
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

func memoryErrorView(r *MemoryError) *MemoryErrorView {
	if r == nil {
		return nil
	}
	return &MemoryErrorView{
		Tool:         r.Tool,
		Type:         r.Type,
		Address:      r.Address,
		Size:         r.Size,
		Deallocation: memoryErrorStackView(r.Deallocation),
		Allocation:   memoryErrorStackView(r.Allocation),
	}
}

func memoryErrorStackView(s *MemoryErrorStack) *MemoryErrorStackView {
	if s == nil {
		return nil
	}
	return &MemoryErrorStackView{
		ThreadID:   s.ThreadID,
		ThreadName: s.ThreadName,
		Frames:     NativeStackLines(s.Frames),
	}
}
