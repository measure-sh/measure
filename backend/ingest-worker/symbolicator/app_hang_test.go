package symbolicator

import (
	"strings"
	"testing"
	"time"

	"backend/libs/event"

	"github.com/google/uuid"
)

// makeAppHangEvent builds a minimal app hang event with the given
// frames on the blocked main thread.
func makeAppHangEvent(frames event.Frames) event.EventField {
	return event.EventField{
		ID:        uuid.New(),
		SessionID: uuid.New(),
		Timestamp: time.Now(),
		Type:      event.TypeAppHang,
		Attribute: event.Attribute{
			OSName:        "ios",
			OSVersion:     "18.5",
			AppVersion:    "1.0",
			AppBuild:      "42",
			DeviceCPUArch: "arm64",
		},
		AppHang: &event.AppHang{
			Exceptions: event.AppHangDetails{
				{
					ThreadName:     "main",
					ThreadSequence: 0,
					OSBuildNumber:  "22F76",
					Frames:         frames,
				},
			},
			Duration:   2500,
			State:      event.AppHangStateRecovered,
			Framework:  event.FrameworkApple,
			Foreground: true,
			BinaryImages: []event.BinaryImage{
				{
					StartAddr: "0000000104a10000",
					EndAddr:   "0000000104b8ffff",
					System:    false,
					Name:      "DemoApp",
					Arch:      "arm64",
					Uuid:      "b1f4c9a23d773f0e9c215a8e7d64b019",
					Path:      "/DemoApp.app/DemoApp",
				},
				{
					StartAddr: "00000001a0000000",
					EndAddr:   "00000001a0ffffff",
					System:    true,
					Name:      "CoreFoundation",
					Arch:      "arm64e",
					Uuid:      "c2e5daa34e884a1fad326b9f8e75c12a",
					Path:      "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation",
				},
			},
		},
	}
}

func makeiOSFrame(index int, binary, symbolAddr string) event.Frame {
	return event.Frame{
		FrameiOS: &event.FrameiOS{
			FrameIndex:    index,
			BinaryName:    binary,
			BinaryAddress: "0000000104a10000",
			SymbolAddress: symbolAddr,
			Offset:        64,
		},
	}
}

func TestMakeAppleHangReport(t *testing.T) {
	ev := makeAppHangEvent(event.Frames{
		makeiOSFrame(0, "DemoApp", "0000000104a3f5c0"),
		makeiOSFrame(1, "CoreFoundation", "00000001a0001234"),
	})

	as := &appleSymbolicator{}
	as.makeAppleHangReport(ev)
	report := string(as.appleCrashReport)

	for _, want := range []string{
		"Version: 1.0 (42)",
		"Code Type: arm64",
		"OS Version: iPhone OS 18.5 (22F76)",
		"Exception Type:",
		"Crashed Thread: 0",
		"Thread 0 name:  main",
		"Thread 0 Crashed:",
		"0    DemoApp    0x0000000104a3f5c0 0x0000000104a10000 + 64",
		"1    CoreFoundation    0x00000001a0001234 0x0000000104a10000 + 64",
		"Binary Images:",
	} {
		if !strings.Contains(report, want) {
			t.Errorf("Expected report to contain %q, report was:\n%s", want, report)
		}
	}

	// the app image is marked "+", the system image "-"
	if !strings.Contains(report, "+DemoApp") {
		t.Errorf("Expected app binary image to be marked in app, report was:\n%s", report)
	}
	if !strings.Contains(report, "-CoreFoundation") {
		t.Errorf("Expected system binary image to be marked system, report was:\n%s", report)
	}
}

// A frame without iOS frame data has no address to symbolicate. It must
// be skipped rather than dereferenced, the same hazard that once caused a
// production SIGSEGV in makeAppleCrashReport.
func TestMakeAppleHangReportNilFrameiOS(t *testing.T) {
	ev := makeAppHangEvent(event.Frames{
		{MethodName: "noAddresses"},
		makeiOSFrame(1, "DemoApp", "0000000104a3f5c0"),
	})

	as := &appleSymbolicator{}

	// Must not panic.
	as.makeAppleHangReport(ev)

	report := string(as.appleCrashReport)
	if strings.Contains(report, "noAddresses") {
		t.Errorf("Expected frame without addresses to be skipped, report was:\n%s", report)
	}
	if !strings.Contains(report, "1    DemoApp") {
		t.Errorf("Expected the remaining frame to be written, report was:\n%s", report)
	}
}

func TestRewriteAppleHangReport(t *testing.T) {
	ev := makeAppHangEvent(event.Frames{
		makeiOSFrame(0, "DemoApp", "0000000104a3f5c0"),
		makeiOSFrame(1, "CoreFoundation", "00000001a0001234"),
	})

	as := appleSymbolicator{
		response: &responseApple{
			Stacktraces: []stacktraceApple{
				{
					Frames: []frameApple{
						{
							Status:        "symbolicated",
							OriginalIndex: 0,
							Function:      "blockMainThread",
							Filename:      "ViewController.swift",
							LineNo:        128,
						},
						{
							// not symbolicated, must be left alone
							Status:        "missing",
							OriginalIndex: 1,
							Function:      "ignored",
							Filename:      "ignored.swift",
							LineNo:        1,
						},
					},
				},
			},
		},
	}

	as.rewriteAppleHangReport(ev)

	frames := ev.AppHang.Exceptions[0].Frames
	if frames[0].MethodName != "blockMainThread" {
		t.Errorf("Expected method name to be rewritten, got %q", frames[0].MethodName)
	}
	if frames[0].FileName != "ViewController.swift" {
		t.Errorf("Expected file name to be rewritten, got %q", frames[0].FileName)
	}
	if frames[0].LineNum != 128 {
		t.Errorf("Expected line number to be rewritten, got %d", frames[0].LineNum)
	}
	if frames[1].MethodName != "" {
		t.Errorf("Expected unsymbolicated frame to be left alone, got %q", frames[1].MethodName)
	}
}

// The symbolicator response is external input, so indices that do not
// line up with the event must be ignored instead of panicking.
func TestRewriteAppleHangReportOutOfRangeIndices(t *testing.T) {
	ev := makeAppHangEvent(event.Frames{
		makeiOSFrame(0, "DemoApp", "0000000104a3f5c0"),
	})

	as := appleSymbolicator{
		response: &responseApple{
			Stacktraces: []stacktraceApple{
				{
					Frames: []frameApple{
						{Status: "symbolicated", OriginalIndex: 99, Function: "outOfRange"},
						{Status: "symbolicated", OriginalIndex: -1, Function: "negative"},
					},
				},
				{
					// more stacktraces than blocked threads
					Frames: []frameApple{
						{Status: "symbolicated", OriginalIndex: 0, Function: "extraThread"},
					},
				},
			},
		},
	}

	// Must not panic.
	as.rewriteAppleHangReport(ev)

	if got := ev.AppHang.Exceptions[0].Frames[0].MethodName; got != "" {
		t.Errorf("Expected no rewrite from out of range indices, got %q", got)
	}
}

// An app hang routes through the in place Apple path. With a symbolicator
// initialized for a non-Apple OS it must be skipped, not panic on the nil
// appleSymbolicator receiver.
func TestSymbolicateAppHangWithoutAppleSymbolicator(t *testing.T) {
	s := New("http://localhost:3021", "android", nil, nil)

	evs := []event.EventField{makeAppHangEvent(event.Frames{
		makeiOSFrame(0, "DemoApp", "0000000104a3f5c0"),
	})}

	if err := s.Symbolicate(nil, nil, uuid.New(), evs, nil); err != nil { //nolint:staticcheck
		t.Errorf("Expected no error symbolicating batch, got %v", err)
	}
}
