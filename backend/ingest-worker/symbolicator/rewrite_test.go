package symbolicator

import (
	"backend/api/event"
	"testing"
	"time"

	"github.com/google/uuid"
)

// makeExceptionEvent builds a minimal exception EventField with the given
// exception frames and thread frames.
func makeExceptionEvent(excFrames, threadFrames event.Frames) event.EventField {
	return event.EventField{
		ID:        uuid.New(),
		SessionID: uuid.New(),
		Timestamp: time.Now(),
		Type:      event.TypeException,
		Attribute: event.Attribute{OSName: "android"},
		Exception: &event.Exception{
			Exceptions: event.ExceptionUnits{
				{Type: "java.lang.RuntimeException", Frames: excFrames},
			},
			Threads: event.Threads{
				{Name: "main", Frames: threadFrames},
			},
		},
	}
}

// TestRewriteException_FewerFramesThanOriginal verifies that rewriteException
// does not panic when the symbolicator response contains fewer frames than the
// original event. This was the root cause of the production panics where the
// upgraded symbolicator started omitting frames it could not process.
func TestRewriteException_FewerFramesThanOriginal(t *testing.T) {
	// Original event has 3 frames in both the exception and the thread.
	origFrames := event.Frames{
		{LineNum: 10, ClassName: "a.b.A", MethodName: "foo", FileName: "A.java"},
		{LineNum: 20, ClassName: "a.b.B", MethodName: "bar", FileName: "B.java"},
		{LineNum: 30, ClassName: "a.b.C", MethodName: "baz", FileName: "C.java"},
	}
	ev := makeExceptionEvent(append(event.Frames{}, origFrames...), append(event.Frames{}, origFrames...))
	evs := []event.EventField{ev}

	// Symbolicator returns only 2 frames (drops the last one).
	symbolicatedFrames := []frameJVM{
		{Function: "foo_sym", Filename: "A.java", Module: "com.example.A", LineNo: 10},
		{Function: "bar_sym", Filename: "B.java", Module: "com.example.B", LineNo: 20},
	}

	// Two stacktraces: one for the exception, one for the thread.
	// Each is indexed separately in the LUT.
	response := &responseJVM{
		Status: "completed",
		Stacktraces: []stacktraceJVM{
			{Frames: symbolicatedFrames}, // index 0: exception stacktrace
			{Frames: symbolicatedFrames}, // index 1: thread stacktrace
		},
		Classes: map[string]string{},
	}

	// LUT entries: one per frame per exception/thread.
	// Format: {event_idx, j, k, l, m, stacktrace_n}
	//   exception entries: j=0, k=frame_idx, l=-1, m=-1, n=0
	//   thread entries:    j=-1, k=-1, l=0, m=frame_idx, n=1
	lut := []stacktraceEntry{
		{0, 0, 0, -1, -1, 0}, // exception frame 0
		{0, 0, 1, -1, -1, 0}, // exception frame 1
		{0, 0, 2, -1, -1, 0}, // exception frame 2 — symbolicator dropped this
		{0, -1, -1, 0, 0, 1}, // thread frame 0
		{0, -1, -1, 0, 1, 1}, // thread frame 1
		{0, -1, -1, 0, 2, 1}, // thread frame 2 — symbolicator dropped this
	}

	js := jvmSymbolicator{
		request:       &requestJVM{},
		response:      response,
		stacktraceLUT: lut,
	}

	// Must not panic.
	js.rewriteException(evs, nil, false)

	exc := evs[0].Exception.Exceptions[0]
	th := evs[0].Exception.Threads[0]

	// Frames 0 and 1 should be symbolicated.
	if exc.Frames[0].MethodName != "foo_sym" {
		t.Errorf("exception frame 0 method: got %q, want %q", exc.Frames[0].MethodName, "foo_sym")
	}
	if exc.Frames[1].MethodName != "bar_sym" {
		t.Errorf("exception frame 1 method: got %q, want %q", exc.Frames[1].MethodName, "bar_sym")
	}
	// Frame 2 was dropped by the symbolicator — original data must be preserved.
	if exc.Frames[2].MethodName != origFrames[2].MethodName {
		t.Errorf("exception frame 2 method: got %q, want original %q", exc.Frames[2].MethodName, origFrames[2].MethodName)
	}

	if th.Frames[0].MethodName != "foo_sym" {
		t.Errorf("thread frame 0 method: got %q, want %q", th.Frames[0].MethodName, "foo_sym")
	}
	if th.Frames[1].MethodName != "bar_sym" {
		t.Errorf("thread frame 1 method: got %q, want %q", th.Frames[1].MethodName, "bar_sym")
	}
	// Frame 2 was dropped by the symbolicator — original data must be preserved.
	if th.Frames[2].MethodName != origFrames[2].MethodName {
		t.Errorf("thread frame 2 method: got %q, want original %q", th.Frames[2].MethodName, origFrames[2].MethodName)
	}
}

// TestRewriteException_EqualFrameCount verifies that when the symbolicator
// returns exactly the same number of frames, all frames are rewritten.
func TestRewriteException_EqualFrameCount(t *testing.T) {
	origFrames := event.Frames{
		{LineNum: 10, ClassName: "a.b.A", MethodName: "foo", FileName: "A.java"},
		{LineNum: 20, ClassName: "a.b.B", MethodName: "bar", FileName: "B.java"},
	}
	ev := makeExceptionEvent(append(event.Frames{}, origFrames...), append(event.Frames{}, origFrames...))
	evs := []event.EventField{ev}

	symbolicatedFrames := []frameJVM{
		{Function: "foo_sym", Filename: "A.java", Module: "com.example.A", LineNo: 10},
		{Function: "bar_sym", Filename: "B.java", Module: "com.example.B", LineNo: 20},
	}

	response := &responseJVM{
		Status: "completed",
		Stacktraces: []stacktraceJVM{
			{Frames: symbolicatedFrames},
			{Frames: symbolicatedFrames},
		},
		Classes: map[string]string{},
	}

	lut := []stacktraceEntry{
		{0, 0, 0, -1, -1, 0},
		{0, 0, 1, -1, -1, 0},
		{0, -1, -1, 0, 0, 1},
		{0, -1, -1, 0, 1, 1},
	}

	js := jvmSymbolicator{request: &requestJVM{}, response: response, stacktraceLUT: lut}
	js.rewriteException(evs, nil, false)

	exc := evs[0].Exception.Exceptions[0]
	th := evs[0].Exception.Threads[0]

	for i, want := range []string{"foo_sym", "bar_sym"} {
		if exc.Frames[i].MethodName != want {
			t.Errorf("exception frame %d: got %q, want %q", i, exc.Frames[i].MethodName, want)
		}
		if th.Frames[i].MethodName != want {
			t.Errorf("thread frame %d: got %q, want %q", i, th.Frames[i].MethodName, want)
		}
	}
}
