package event

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

// makeAppHangFrame builds an iOS frame with the address fields the
// Apple symbolication path needs.
func makeAppHangFrame(index int, binary, method, file string, inApp bool) Frame {
	return makeAppHangFrameAt(index, binary, method, file, inApp, "0000000104a10000", "0000000104a3f5c0")
}

// makeAppHangFrameAt varies the addresses, which is what an unsymbolicated
// fingerprint is computed from.
func makeAppHangFrameAt(index int, binary, method, file string, inApp bool, binaryAddr, symbolAddr string) Frame {
	return Frame{
		MethodName: method,
		FileName:   file,
		InApp:      inApp,
		FrameiOS: &FrameiOS{
			FrameIndex:    index,
			BinaryName:    binary,
			BinaryAddress: binaryAddr,
			SymbolAddress: symbolAddr,
			Offset:        64,
		},
	}
}

func makeAppHang(frames Frames) *AppHang {
	return &AppHang{
		Exceptions: AppHangDetails{
			{
				ThreadName:     "main",
				ThreadSequence: 0,
				OSBuildNumber:  "22F76",
				Frames:         frames,
			},
		},
		Duration:   2500,
		State:      AppHangStateRecovered,
		Framework:  FrameworkApple,
		Foreground: true,
		BinaryImages: []BinaryImage{
			{
				StartAddr: "0000000104a10000",
				EndAddr:   "0000000104b8ffff",
				System:    false,
				Name:      "DemoApp",
				Arch:      "arm64",
				Uuid:      "b1f4c9a23d773f0e9c215a8e7d64b019",
				Path:      "/private/var/containers/Bundle/Application/DemoApp.app/DemoApp",
			},
		},
	}
}

func makeAppHangEvent(hang *AppHang) EventField {
	return EventField{
		ID:        uuid.New(),
		AppID:     uuid.New(),
		SessionID: uuid.New(),
		Timestamp: time.Now(),
		Type:      TypeAppHang,
		Attribute: Attribute{OSName: "ios"},
		AppHang:   hang,
	}
}

func TestAppHangUnmarshalsSDKPayload(t *testing.T) {
	// the shape the iOS SDK encodes, keys included.
	payload := `{
		"exceptions": [
			{
				"thread_name": "main",
				"thread_sequence": 0,
				"os_build_number": "22F76",
				"frames": [
					{
						"binary_name": "DemoApp",
						"binary_address": "0000000104a10000",
						"offset": 64,
						"frame_index": 0,
						"symbol_address": "0000000104a3f5c0",
						"in_app": true
					}
				]
			}
		],
		"duration": 2500,
		"state": "recovered",
		"framework": "apple",
		"foreground": true,
		"binary_images": [
			{
				"start_addr": "0000000104a10000",
				"end_addr": "0000000104b8ffff",
				"system": false,
				"name": "DemoApp",
				"arch": "arm64",
				"uuid": "b1f4c9a23d773f0e9c215a8e7d64b019",
				"path": "/DemoApp.app/DemoApp"
			}
		]
	}`

	var hang AppHang
	if err := json.Unmarshal([]byte(payload), &hang); err != nil {
		t.Fatalf("Unexpected error unmarshaling app hang: %v", err)
	}

	if len(hang.Exceptions) != 1 {
		t.Fatalf("Expected 1 blocked thread, got %d", len(hang.Exceptions))
	}
	if hang.Exceptions[0].ThreadName != "main" {
		t.Errorf("Expected thread name %q, got %q", "main", hang.Exceptions[0].ThreadName)
	}
	if hang.Exceptions[0].OSBuildNumber != "22F76" {
		t.Errorf("Expected os build number %q, got %q", "22F76", hang.Exceptions[0].OSBuildNumber)
	}
	if hang.Duration != 2500 {
		t.Errorf("Expected duration 2500, got %d", hang.Duration)
	}
	if hang.State != AppHangStateRecovered {
		t.Errorf("Expected state %q, got %q", AppHangStateRecovered, hang.State)
	}
	if !hang.Foreground {
		t.Error("Expected foreground to be true")
	}
	if len(hang.BinaryImages) != 1 {
		t.Fatalf("Expected 1 binary image, got %d", len(hang.BinaryImages))
	}

	frames := hang.Exceptions[0].Frames
	if len(frames) != 1 {
		t.Fatalf("Expected 1 frame, got %d", len(frames))
	}
	if frames[0].FrameiOS == nil {
		t.Fatal("Expected iOS frame data to be populated")
	}
	if frames[0].SymbolAddress != "0000000104a3f5c0" {
		t.Errorf("Expected symbol address to round trip, got %q", frames[0].SymbolAddress)
	}
	if !frames[0].InApp {
		t.Error("Expected frame to be marked in app")
	}
}

func TestAppHangGetRelevantFrame(t *testing.T) {
	t.Run("prefers the first in app frame", func(t *testing.T) {
		hang := makeAppHang(Frames{
			makeAppHangFrame(0, "libsystem_kernel.dylib", "mach_msg2_trap", "", false),
			makeAppHangFrame(1, "DemoApp", "blockMainThread", "ViewController.swift", true),
		})

		frame := hang.GetRelevantFrame()
		if frame.MethodName != "blockMainThread" {
			t.Errorf("Expected in app frame, got %q", frame.MethodName)
		}
	})

	t.Run("falls back to the first frame", func(t *testing.T) {
		hang := makeAppHang(Frames{
			makeAppHangFrame(0, "libsystem_kernel.dylib", "mach_msg2_trap", "", false),
			makeAppHangFrame(1, "CoreFoundation", "__CFRunLoopRun", "", false),
		})

		frame := hang.GetRelevantFrame()
		if frame.MethodName != "mach_msg2_trap" {
			t.Errorf("Expected first frame, got %q", frame.MethodName)
		}
	})

	t.Run("returns a zero frame when there are no frames", func(t *testing.T) {
		hang := makeAppHang(Frames{})

		frame := hang.GetRelevantFrame()
		if frame.MethodName != "" {
			t.Errorf("Expected zero frame, got %q", frame.MethodName)
		}
	})
}

func TestAppHangComputeFingerprint(t *testing.T) {
	t.Run("same blocking frame produces the same fingerprint", func(t *testing.T) {
		first := makeAppHang(Frames{
			makeAppHangFrame(0, "libsystem_kernel.dylib", "mach_msg2_trap", "", false),
			makeAppHangFrame(1, "DemoApp", "blockMainThread", "ViewController.swift", true),
		})
		second := makeAppHang(Frames{
			// a different leading system frame, same in app frame
			makeAppHangFrame(0, "libsystem_pthread.dylib", "pthread_mutex_lock", "", false),
			makeAppHangFrame(1, "DemoApp", "blockMainThread", "ViewController.swift", true),
		})

		if err := first.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if err := second.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if first.Fingerprint != second.Fingerprint {
			t.Errorf("Expected identical fingerprints, got %q and %q", first.Fingerprint, second.Fingerprint)
		}
		if len(first.Fingerprint) != 32 {
			t.Errorf("Expected a 32 character md5 fingerprint, got %q", first.Fingerprint)
		}
	})

	t.Run("a different blocking frame produces a different fingerprint", func(t *testing.T) {
		first := makeAppHang(Frames{
			makeAppHangFrame(0, "DemoApp", "blockMainThread", "ViewController.swift", true),
		})
		second := makeAppHang(Frames{
			makeAppHangFrame(0, "DemoApp", "hangHoldingAllocatorLock", "ViewController.swift", true),
		})

		if err := first.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if err := second.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if first.Fingerprint == second.Fingerprint {
			t.Errorf("Expected different fingerprints, both were %q", first.Fingerprint)
		}
	})

	t.Run("errors when there are no frames", func(t *testing.T) {
		hang := makeAppHang(Frames{})

		if err := hang.ComputeFingerprint(); err == nil {
			t.Error("Expected an error computing a fingerprint with no frames")
		}
	})

	// A build whose dSYM was never uploaded still produces frames, with
	// addresses but no names. Those hangs still group, by where in the
	// binary they blocked.
	t.Run("fingerprints a hang that carries no symbols", func(t *testing.T) {
		hang := makeAppHang(Frames{
			makeAppHangFrame(0, "DemoApp", "", "", true),
		})

		if err := hang.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error fingerprinting without symbols: %v", err)
		}
		if len(hang.Fingerprint) != 32 {
			t.Errorf("Expected a 32 character fingerprint, got %q", hang.Fingerprint)
		}
	})

	t.Run("the same unsymbolicated call site gives the same fingerprint", func(t *testing.T) {
		// ASLR slides the image and the frame by the same amount, so two
		// launches of one build report different addresses for one call site.
		first := makeAppHang(Frames{
			makeAppHangFrameAt(0, "DemoApp", "", "", true, "0000000104a10000", "0000000104a3f5c0"),
		})
		second := makeAppHang(Frames{
			makeAppHangFrameAt(0, "DemoApp", "", "", true, "0000000200000000", "000000020002f5c0"),
		})

		if err := first.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if err := second.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if first.Fingerprint != second.Fingerprint {
			t.Errorf("Expected ASLR to not change the fingerprint, got %q and %q", first.Fingerprint, second.Fingerprint)
		}
	})

	t.Run("a different unsymbolicated call site gives a different fingerprint", func(t *testing.T) {
		first := makeAppHang(Frames{
			makeAppHangFrameAt(0, "DemoApp", "", "", true, "0000000104a10000", "0000000104a3f5c0"),
		})
		second := makeAppHang(Frames{
			makeAppHangFrameAt(0, "DemoApp", "", "", true, "0000000104a10000", "0000000104a99999"),
		})

		if err := first.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if err := second.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if first.Fingerprint == second.Fingerprint {
			t.Errorf("Expected different call sites to differ, both were %q", first.Fingerprint)
		}
	})

	// The same hazard an unsymbolicated Apple exception has: it does not
	// share a group with the symbolicated form of the same hang.
	t.Run("symbols change the fingerprint of the same call site", func(t *testing.T) {
		bare := makeAppHang(Frames{
			makeAppHangFrame(0, "DemoApp", "", "", true),
		})
		symbolicated := makeAppHang(Frames{
			makeAppHangFrame(0, "DemoApp", "blockMainThread", "ViewController.swift", true),
		})

		if err := bare.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if err := symbolicated.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if bare.Fingerprint == symbolicated.Fingerprint {
			t.Error("Expected symbolication to refine the fingerprint")
		}
	})
}

func TestAppHangNeedsSymbolication(t *testing.T) {
	t.Run("true when frames are present", func(t *testing.T) {
		ev := makeAppHangEvent(makeAppHang(Frames{
			makeAppHangFrame(0, "DemoApp", "", "", true),
		}))

		if !ev.NeedsSymbolication() {
			t.Error("Expected an app hang with frames to need symbolication")
		}
	})

	t.Run("false when there are no frames", func(t *testing.T) {
		ev := makeAppHangEvent(makeAppHang(Frames{}))

		if ev.NeedsSymbolication() {
			t.Error("Expected an app hang without frames to skip symbolication")
		}
	})
}

func TestAppHangValidate(t *testing.T) {
	t.Run("accepts a well formed app hang", func(t *testing.T) {
		ev := makeAppHangEvent(makeAppHang(Frames{
			makeAppHangFrame(0, "DemoApp", "blockMainThread", "ViewController.swift", true),
		}))

		if err := ev.Validate(); err != nil {
			t.Errorf("Unexpected error validating app hang: %v", err)
		}
	})

	t.Run("accepts a killed hang", func(t *testing.T) {
		hang := makeAppHang(Frames{makeAppHangFrame(0, "DemoApp", "blockMainThread", "ViewController.swift", true)})
		hang.State = AppHangStateKilled
		ev := makeAppHangEvent(hang)

		if err := ev.Validate(); err != nil {
			t.Errorf("Unexpected error validating killed app hang: %v", err)
		}
		if !hang.IsKilled() {
			t.Error("Expected IsKilled to report true")
		}
	})

	t.Run("rejects an app hang with no blocked thread", func(t *testing.T) {
		hang := makeAppHang(Frames{})
		hang.Exceptions = AppHangDetails{}
		ev := makeAppHangEvent(hang)

		if err := ev.Validate(); err == nil {
			t.Error("Expected an error validating an app hang with no blocked thread")
		}
	})

	// The SDK discards a hang whose capture came back empty. This rejects
	// any that reaches the server anyway, so every stored hang can be
	// grouped.
	t.Run("rejects an app hang with no frames", func(t *testing.T) {
		ev := makeAppHangEvent(makeAppHang(Frames{}))

		if err := ev.Validate(); err == nil {
			t.Error("Expected an error validating an app hang with no frames")
		}
	})

	t.Run("rejects an unknown state", func(t *testing.T) {
		hang := makeAppHang(Frames{makeAppHangFrame(0, "DemoApp", "blockMainThread", "ViewController.swift", true)})
		hang.State = "stuck"
		ev := makeAppHangEvent(hang)

		if err := ev.Validate(); err == nil {
			t.Error("Expected an error validating an unknown app hang state")
		}
	})

	t.Run("rejects a binary image missing its start address", func(t *testing.T) {
		hang := makeAppHang(Frames{makeAppHangFrame(0, "DemoApp", "blockMainThread", "ViewController.swift", true)})
		hang.BinaryImages[0].StartAddr = ""
		ev := makeAppHangEvent(hang)

		if err := ev.Validate(); err == nil {
			t.Error("Expected an error validating a binary image without a start address")
		}
	})

	t.Run("rejects an app hang on android", func(t *testing.T) {
		ev := makeAppHangEvent(makeAppHang(Frames{
			makeAppHangFrame(0, "DemoApp", "blockMainThread", "ViewController.swift", true),
		}))
		ev.Attribute.OSName = "android"

		if err := ev.Validate(); err == nil {
			t.Error("Expected app hang to be rejected for android")
		}
	})
}
