package artdump

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"
)

// threadBlocks splits a dump into one string per thread and sorts
// them, because Populate changes the thread order. Lines that Render
// never writes are skipped.
func threadBlocks(dump string) []string {
	var blocks []string
	for line := range strings.SplitSeq(dump, "\n") {
		if strings.HasPrefix(line, "DALVIK THREADS (") || line == "" || strings.HasPrefix(line, dumpLatencyPrefix) {
			continue
		}
		if isThreadHeader(line) || len(blocks) == 0 {
			blocks = append(blocks, line)
		} else {
			blocks[len(blocks)-1] += "\n" + line
		}
	}
	slices.Sort(blocks)
	return blocks
}

// Runs each real dump through the same steps as ingest: parse, populate,
// then save to and load from JSON. Checks the populated fields, then
// checks that rendering gives back the original threads.
func TestRealDumps(t *testing.T) {
	tests := []struct {
		fixture       string
		mainHeader    string
		blamed        string
		blockingChain []int
		cause         string
		groupingFrame Frame
	}{
		{
			// Same as api31_broadcast_lock, on Android 11, which prints
			// a frame without a line number as ":-1".
			fixture:       "api30_broadcast_lock.txt",
			mainHeader:    `"main" prio=5 tid=1 Blocked`,
			blamed:        "APP: Locker",
			blockingChain: []int{1, 4},
			cause:         CauseBlocked,
			groupingFrame: Frame{ClassName: "sh.frankenstein.android.AnrBroadcastReceiver$Companion", MethodName: "trigger$lambda$0", FileName: "AnrBroadcastReceiver.kt", LineNum: 24, InApp: true},
		},
		{
			// A broadcast receiver on main is blocked on a lock held by
			// another thread.
			fixture:       "api31_broadcast_lock.txt",
			mainHeader:    `"main" prio=5 tid=1 Blocked`,
			blamed:        "APP: Locker",
			blockingChain: []int{1, 43},
			cause:         CauseBlocked,
			groupingFrame: Frame{ClassName: "sh.frankenstein.android.AnrBroadcastReceiver$Companion", MethodName: "trigger$lambda$0", FileName: "AnrBroadcastReceiver.kt", LineNum: 24, InApp: true},
		},
		{
			// A Handler callback on main is blocked on a lock held by
			// another thread.
			fixture:       "api31_deadlock.txt",
			mainHeader:    `"main" prio=5 tid=1 Blocked`,
			blamed:        "APP: Locker",
			blockingChain: []int{1, 40},
			cause:         CauseBlocked,
			groupingFrame: Frame{ClassName: "sh.frankenstein.android.NativeAndroidScreenKt", MethodName: "NativeAndroidScreen$lambda$29$0$0", FileName: "NativeAndroidScreen.kt", LineNum: 219, InApp: true},
		},
		{
			// Main thread is stuck in an infinite loop.
			fixture:       "api31_infinite_loop.txt",
			mainHeader:    `"main" prio=5 tid=1 Runnable`,
			blamed:        "main",
			cause:         CauseSlowOperation,
			groupingFrame: Frame{ClassName: "sh.frankenstein.android.NativeAndroidScreenKt", MethodName: "DemoCard$lambda$0$0", FileName: "NativeAndroidScreen.kt", LineNum: 545, InApp: true},
		},
		{
			// Main calls Thread.sleep in app code.
			fixture:       "api31_thread_sleep.txt",
			mainHeader:    `"main" prio=5 tid=1 Sleeping`,
			blamed:        "main",
			cause:         CauseWaiting,
			groupingFrame: Frame{ClassName: "sh.frankenstein.android.NativeAndroidScreenKt", MethodName: "NativeAndroidScreen$lambda$30$0", FileName: "NativeAndroidScreen.kt", LineNum: 238, InApp: true},
		},
		{
			// A service's onStartCommand on main calls Thread.sleep.
			fixture:       "api31_service_sleep.txt",
			mainHeader:    `"main" prio=5 tid=1 Sleeping`,
			blamed:        "main",
			cause:         CauseWaiting,
			groupingFrame: Frame{ClassName: "sh.frankenstein.android.AnrService", MethodName: "onStartCommand", FileName: "AnrService.kt", LineNum: 20, InApp: true},
		},
		{
			// Main is idle, waiting for the next message.
			fixture:       "api33_idle_main.txt",
			mainHeader:    `"main" prio=5 tid=1 Native`,
			blamed:        "main",
			cause:         CauseIdle,
			groupingFrame: Frame{ClassName: "android.os.MessageQueue", MethodName: "nativePollOnce", FileName: "Native method", LineNum: NoLineNum},
		},
		{
			// Same as api31_broadcast_lock, on Android 16.
			fixture:       "api36_deadlock.txt",
			mainHeader:    `"main" prio=5 tid=1 Blocked`,
			blamed:        "APP: Locker",
			blockingChain: []int{1, 46},
			cause:         CauseBlocked,
			groupingFrame: Frame{ClassName: "sh.frankenstein.android.AnrBroadcastReceiver$Companion", MethodName: "trigger$lambda$0", FileName: "AnrBroadcastReceiver.kt", LineNum: 24, InApp: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.fixture, func(t *testing.T) {
			b, err := os.ReadFile(filepath.Join("testdata", tt.fixture))
			if err != nil {
				t.Fatalf("read fixture: %v", err)
			}
			input := string(b)

			dump := Parse(input)
			if !dump.HasMainFrame() {
				t.Fatal("got no main frame, want one")
			}
			dump.Populate()

			encoded, err := json.Marshal(dump)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var stored Dump
			if err := json.Unmarshal(encoded, &stored); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}

			if got := stored.mainThread().Header; got != tt.mainHeader {
				t.Errorf("main thread = %q, want %q", got, tt.mainHeader)
			}
			if got := stored.Threads[0].Name; got != tt.blamed {
				t.Errorf("blamed %q, want %q", got, tt.blamed)
			}
			if !slices.Equal(stored.BlockingChain, tt.blockingChain) {
				t.Errorf("blocking chain = %v, want %v", stored.BlockingChain, tt.blockingChain)
			}
			if stored.Cause != tt.cause {
				t.Errorf("cause = %q, want %q", stored.Cause, tt.cause)
			}
			frame := stored.GroupingFrame
			frame.Locks = nil
			if !reflect.DeepEqual(frame, tt.groupingFrame) {
				t.Errorf("grouping frame = %+v, want %+v", frame, tt.groupingFrame)
			}

			want, got := threadBlocks(input), threadBlocks(stored.Render())
			if len(got) != len(want) {
				t.Fatalf("rendered %d thread blocks, want %d", len(got), len(want))
			}
			for i := range want {
				if got[i] != want[i] {
					t.Errorf("rendered block differs:\n got %q\nwant %q", got[i], want[i])
				}
			}
		})
	}
}
