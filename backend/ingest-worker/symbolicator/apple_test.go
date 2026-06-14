package symbolicator

import (
	"backend/api/event"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

// makeAppleExceptionEvent builds a minimal apple-framework
// exception event with the given exception units.
func makeAppleExceptionEvent(units event.ExceptionUnits) event.EventField {
	return event.EventField{
		ID:        uuid.New(),
		SessionID: uuid.New(),
		Timestamp: time.Now(),
		Type:      event.TypeException,
		Attribute: event.Attribute{OSName: "ios"},
		Exception: &event.Exception{
			Framework:  event.FrameworkApple,
			Exceptions: units,
			Threads: event.Threads{
				{Name: "main", Frames: event.Frames{}},
			},
		},
	}
}

// TestSymbolicateAppleEventWithoutAppleSymbolicator verifies that an
// apple-framework exception event in a batch whose Symbolicator was
// initialized for a non-Apple OS is skipped instead of panicking on
// the nil appleSymbolicator receiver. This was the root cause of a
// production SIGSEGV in makeAppleCrashReport.
func TestSymbolicateAppleEventWithoutAppleSymbolicator(t *testing.T) {
	s := New("http://localhost:3021", "android", nil, nil)

	units := event.ExceptionUnits{
		{
			Type: "EXC_BAD_ACCESS",
			ExceptionUnitiOS: &event.ExceptionUnitiOS{
				Signal: "SIGSEGV",
			},
			Frames: event.Frames{},
		},
	}
	evs := []event.EventField{makeAppleExceptionEvent(units)}

	// Must not panic. The apple event is skipped before any
	// database or symbolicator service access.
	if err := s.Symbolicate(context.Background(), nil, uuid.New(), evs, nil); err != nil {
		t.Errorf("Expected no error symbolicating batch, got %v", err)
	}
}

// TestMakeAppleCrashReportNilExceptionUnitiOS verifies that exception
// units lacking iOS unit data are skipped instead of panicking on the
// nil embedded ExceptionUnitiOS pointer.
func TestMakeAppleCrashReportNilExceptionUnitiOS(t *testing.T) {
	units := event.ExceptionUnits{
		{
			Type: "EXC_BAD_ACCESS",
			ExceptionUnitiOS: &event.ExceptionUnitiOS{
				Signal:        "SIGSEGV",
				ThreadName:    "main",
				OSBuildNumber: "22F76",
			},
			Frames: event.Frames{},
		},
		{
			Type:   "NSGenericException",
			Frames: event.Frames{},
		},
	}
	ev := makeAppleExceptionEvent(units)

	as := &appleSymbolicator{}

	// Must not panic.
	as.makeAppleCrashReport(ev)

	report := string(as.appleCrashReport)
	if got := strings.Count(report, "Exception Type:"); got != 1 {
		t.Errorf("Expected exactly 1 crash report section, got %d:\n%s", got, report)
	}
}
