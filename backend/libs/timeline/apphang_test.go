package timeline

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"backend/libs/event"

	"github.com/google/uuid"
)

func appHangEvent(duration uint32, state string, frames event.Frames) event.EventField {
	return event.EventField{
		ID:        uuid.New(),
		Type:      event.TypeAppHang,
		Timestamp: time.Date(2026, 9, 29, 10, 0, 0, 0, time.UTC),
		Attribute: event.Attribute{OSName: "ios", ThreadName: "main"},
		AppHang: &event.AppHang{
			Exceptions: event.AppHangDetails{
				{ThreadName: "main", ThreadSequence: 0, OSBuildNumber: "22F76", Frames: frames},
			},
			Duration:    duration,
			State:       state,
			Framework:   event.FrameworkApple,
			Foreground:  true,
			Fingerprint: "e2e66b03a50e90849b46300845805c50",
		},
	}
}

func symbolicatedFrames() event.Frames {
	return event.Frames{
		{
			MethodName: "mach_msg2_trap",
			InApp:      false,
			FrameiOS:   &event.FrameiOS{FrameIndex: 0, BinaryName: "libsystem_kernel.dylib", SymbolAddress: "00000001f0001111"},
		},
		{
			MethodName: "ViewController.blockMainThread()",
			FileName:   "ViewController.swift",
			LineNum:    214,
			InApp:      true,
			FrameiOS:   &event.FrameiOS{FrameIndex: 1, BinaryName: "DemoApp", SymbolAddress: "0000000104a3f5c0"},
		},
	}
}

func TestComputeAppHangs(t *testing.T) {
	ctx := context.Background()
	appID := uuid.New()

	t.Run("carries the blocking frame and the outcome", func(t *testing.T) {
		events := []event.EventField{appHangEvent(5090, event.AppHangStateRecovered, symbolicatedFrames())}

		result, err := ComputeAppHangs(ctx, &appID, events)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if len(result) != 1 {
			t.Fatalf("Expected 1 timeline entry, got %d", len(result))
		}

		hang, ok := result[0].(AppHang)
		if !ok {
			t.Fatalf("Expected an AppHang, got %T", result[0])
		}

		if hang.EventType != event.TypeAppHang {
			t.Errorf("Expected event type %q, got %q", event.TypeAppHang, hang.EventType)
		}
		if hang.Duration != 5090 {
			t.Errorf("Expected duration 5090, got %d", hang.Duration)
		}
		if hang.State != event.AppHangStateRecovered {
			t.Errorf("Expected state %q, got %q", event.AppHangStateRecovered, hang.State)
		}
		// the in app frame is what the hang is attributed to, not the top
		// system frame the thread happens to be parked in.
		if hang.MethodName != "ViewController.blockMainThread()" {
			t.Errorf("Expected the in app frame, got %q", hang.MethodName)
		}
		if hang.FileName != "ViewController.swift" {
			t.Errorf("Expected file name, got %q", hang.FileName)
		}
		if hang.LineNumber != 214 {
			t.Errorf("Expected line number 214, got %d", hang.LineNumber)
		}
		if !hang.Foreground {
			t.Error("Expected foreground to be true")
		}
		if hang.GroupId != "e2e66b03a50e90849b46300845805c50" {
			t.Errorf("Expected the fingerprint as group id, got %q", hang.GroupId)
		}
		if hang.Stacktrace == "" {
			t.Error("Expected a stacktrace")
		}
	})

	t.Run("reports a killed hang", func(t *testing.T) {
		events := []event.EventField{appHangEvent(30000, event.AppHangStateKilled, symbolicatedFrames())}

		result, err := ComputeAppHangs(ctx, &appID, events)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		hang := result[0].(AppHang)
		if hang.State != event.AppHangStateKilled {
			t.Errorf("Expected state %q, got %q", event.AppHangStateKilled, hang.State)
		}
	})

	// a hang ingested before its dSYM was uploaded has addresses but no
	// symbols. it still belongs on the timeline.
	t.Run("holds up for an unsymbolicated hang", func(t *testing.T) {
		frames := event.Frames{
			{InApp: true, FrameiOS: &event.FrameiOS{FrameIndex: 0, BinaryName: "DemoApp", SymbolAddress: "0000000104a3f5c0"}},
		}
		events := []event.EventField{appHangEvent(2500, event.AppHangStateRecovered, frames)}

		result, err := ComputeAppHangs(ctx, &appID, events)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if len(result) != 1 {
			t.Fatalf("Expected the hang to survive, got %d entries", len(result))
		}

		hang := result[0].(AppHang)
		if hang.Duration != 2500 {
			t.Errorf("Expected duration 2500, got %d", hang.Duration)
		}
		if hang.MethodName != "" {
			t.Errorf("Expected no method name, got %q", hang.MethodName)
		}
	})

	// The SDK tracks the hang from its own detector thread, so the event
	// attribute says "unknown". The captured thread names itself, and that
	// is the lane the hang belongs in.
	t.Run("groups onto the thread it blocked, not the one that tracked it", func(t *testing.T) {
		ev := appHangEvent(5090, event.AppHangStateRecovered, symbolicatedFrames())
		ev.Attribute.ThreadName = "unknown"
		events := []event.EventField{ev}

		result, err := ComputeAppHangs(ctx, &appID, events)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		hang := result[0].(AppHang)
		if hang.ThreadName != "main" {
			t.Errorf("Expected the blocked thread %q, got %q", "main", hang.ThreadName)
		}

		threads := GroupByThreads(result)
		if _, ok := threads["main"]; !ok {
			t.Errorf("Expected the hang on the main thread, got threads %v", threads)
		}
	})

	t.Run("falls back to the event attribute when the capture names no thread", func(t *testing.T) {
		ev := appHangEvent(5090, event.AppHangStateRecovered, symbolicatedFrames())
		ev.AppHang.Exceptions[0].ThreadName = ""
		ev.Attribute.ThreadName = "com.example.queue"
		events := []event.EventField{ev}

		result, err := ComputeAppHangs(ctx, &appID, events)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		hang := result[0].(AppHang)
		if hang.ThreadName != "com.example.queue" {
			t.Errorf("Expected the fallback thread name, got %q", hang.ThreadName)
		}
	})

	t.Run("serializes the fields the timeline reads", func(t *testing.T) {
		events := []event.EventField{appHangEvent(5090, event.AppHangStateRecovered, symbolicatedFrames())}
		result, _ := ComputeAppHangs(ctx, &appID, events)

		encoded, err := json.Marshal(result[0])
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		var decoded map[string]any
		if err := json.Unmarshal(encoded, &decoded); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		for _, key := range []string{"event_type", "duration", "state", "method_name", "file_name", "stacktrace", "foreground", "timestamp"} {
			if _, ok := decoded[key]; !ok {
				t.Errorf("Expected %q in the timeline payload, got %v", key, decoded)
			}
		}
		// the frontend keys its title off these two
		if decoded["duration"].(float64) != 5090 {
			t.Errorf("Expected duration 5090, got %v", decoded["duration"])
		}
		if decoded["state"] != event.AppHangStateRecovered {
			t.Errorf("Expected state %q, got %v", event.AppHangStateRecovered, decoded["state"])
		}
	})
}
