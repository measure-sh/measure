package artdump

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// Real ART output. api33Dump is an ANR whose main thread was idle, from an
// app whose frames are still obfuscated. api36Dump is a deadlock.
const (
	api33Dump = "api33_idle_main.txt"
	api36Dump = "api36_deadlock.txt"
)

const (
	mainHeader  = `"main" prio=5 tid=1 Runnable`
	anchorFrame = "  at java.lang.Object.wait(Native method)"
)

func loadDump(t *testing.T, fixture string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", fixture))
	if err != nil {
		t.Fatalf("read fixture %q: %v", fixture, err)
	}
	return string(b)
}

// threadDump wraps block lines in a single thread.
func threadDump(blockLines ...string) string {
	return mainHeader + "\n" + strings.Join(blockLines, "\n")
}

// parseBlock parses a dump holding one thread and returns it. The production
// parser already owns the name parseThread.
func parseBlock(t *testing.T, blockLines ...string) Thread {
	t.Helper()
	dump := Parse(threadDump(blockLines...))
	if len(dump.Threads) != 1 {
		t.Fatalf("got %d threads, want 1", len(dump.Threads))
	}
	return dump.Threads[0]
}

func parseFrame(t *testing.T, line string) Frame {
	t.Helper()
	thread := parseBlock(t, line)
	if len(thread.Frames) != 1 {
		t.Fatalf("got %d frames, want 1", len(thread.Frames))
	}
	return thread.Frames[0]
}

func threadNamed(t *testing.T, dump *Dump, name string) Thread {
	t.Helper()
	for _, thread := range dump.Threads {
		if thread.Name == name {
			return thread
		}
	}
	t.Fatalf("thread %q not found", name)
	return Thread{}
}

func firstDiffLine(want, got string) int {
	w, g := strings.Split(want, "\n"), strings.Split(got, "\n")
	for i := range max(len(w), len(g)) {
		if i >= len(w) || i >= len(g) || w[i] != g[i] {
			return i + 1
		}
	}
	return 0
}

func TestParseThreadHeader(t *testing.T) {
	tests := []struct {
		name string
		line string
		want Thread
	}{
		{
			name: "attached",
			line: `"main" prio=5 tid=1 Blocked`,
			want: Thread{Header: `"main" prio=5 tid=1 Blocked`, Name: "main", Tid: 1},
		},
		{
			name: "daemon",
			line: `"APP: Locker" daemon prio=5 tid=46 Sleeping`,
			want: Thread{Header: `"APP: Locker" daemon prio=5 tid=46 Sleeping`, Name: "APP: Locker", Tid: 46},
		},
		{
			name: "not attached, so it prints no tid",
			line: `"1.io" prio=5 (not attached)`,
			want: Thread{Header: `"1.io" prio=5 (not attached)`, Name: "1.io"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dump := Parse(tt.line)

			if got := dump.Threads[0]; !reflect.DeepEqual(got, tt.want) {
				t.Errorf("thread = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestParseManagedFrame(t *testing.T) {
	got := parseFrame(t, "  at android.os.MessageQueue.next(MessageQueue.java:335)")

	want := Frame{
		ClassName:  "android.os.MessageQueue",
		MethodName: "next",
		FileName:   "MessageQueue.java",
		LineNum:    335,
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("frame = %+v, want %+v", got, want)
	}
}

func TestParseFrameWithoutLineNumber(t *testing.T) {
	got := parseFrame(t, "  at java.lang.Thread.sleep(Native method)")

	want := Frame{
		ClassName:  "java.lang.Thread",
		MethodName: "sleep",
		FileName:   "Native method",
		LineNum:    NoLineNum,
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("frame = %+v, want %+v", got, want)
	}
}

// R8 prints line zero, which is why a missing line number cannot be zero.
func TestParseFrameWithLineZero(t *testing.T) {
	got := parseFrame(t, "  at android.app.ActivityThread.-$$Nest$mhandleReceiver(unavailable:0)")

	if got.FileName != "unavailable" || got.LineNum != 0 {
		t.Errorf("frame = (%s:%d), want (unavailable:0)", got.FileName, got.LineNum)
	}
}

func TestParseNativeFrame(t *testing.T) {
	line := "  native: #00 pc 0004df5c  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+28) (BuildId: 4e07915368c859b1910c68c84a8de75f)"

	got := parseFrame(t, line)

	if got.RawLine != line {
		t.Errorf("raw line = %q, want %q", got.RawLine, line)
	}
	if got.ClassName != "" {
		t.Errorf("class name = %q, want empty, a native frame is not parsed", got.ClassName)
	}
}

func TestParseKeepsUnknownStackLines(t *testing.T) {
	line := "  something ART has never printed"

	if got := parseFrame(t, line); got.RawLine != line {
		t.Errorf("raw line = %q, want %q", got.RawLine, line)
	}
}

func TestParseLock(t *testing.T) {
	thread := parseBlock(t, anchorFrame,
		"  - waiting to lock <0x053dd6df> (a java.lang.Object) held by thread 46")

	want := Lock{
		State:     "waiting to lock",
		Object:    "0x053dd6df",
		ClassName: "java.lang.Object",
		HolderTid: 46,
	}
	if got := thread.Frames[0].Locks[0]; got != want {
		t.Errorf("lock = %+v, want %+v", got, want)
	}
}

func TestParseUnknownObjectLock(t *testing.T) {
	thread := parseBlock(t, anchorFrame, "  - waiting on an unknown object")

	want := Lock{State: "waiting on an unknown object"}
	if got := thread.Frames[0].Locks[0]; got != want {
		t.Errorf("lock = %+v, want %+v", got, want)
	}
}

func TestParseLocksBelongToPreviousFrame(t *testing.T) {
	thread := parseBlock(t,
		"  at java.lang.Object.wait(Native method)",
		"  - waiting on <0x0f53f2a7> (a java.lang.Object)",
		"  at java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:207)",
		"  - locked <0x0f53f2a7> (a java.lang.Object)",
		"  at java.lang.Thread.run(Thread.java:1012)",
	)

	want := []string{"waiting on", "locked", ""}
	if len(thread.Frames) != len(want) {
		t.Fatalf("frames = %d, want %d", len(thread.Frames), len(want))
	}
	for i, state := range want {
		locks := thread.Frames[i].Locks
		if state == "" {
			if len(locks) != 0 {
				t.Errorf("frame %d holds %d locks, want none", i, len(locks))
			}
			continue
		}
		if len(locks) != 1 || locks[0].State != state {
			t.Errorf("frame %d locks = %+v, want one %q", i, locks, state)
		}
	}
}

func TestParseThreadTrailer(t *testing.T) {
	trailer := []string{"DumpLatencyMs: 92.0013", ""}

	thread := parseBlock(t, append([]string{anchorFrame}, trailer...)...)

	if len(thread.Frames) != 1 {
		t.Errorf("frames = %d, want 1", len(thread.Frames))
	}
	if !reflect.DeepEqual(thread.Trailer, trailer) {
		t.Errorf("trailer = %q, want %q", thread.Trailer, trailer)
	}
}

// ART prints this where the frames would go, so it is stack content
// rather than something closing the block.
func TestParseKeepsTheNoManagedFramesMarker(t *testing.T) {
	const marker = "  (no managed stack frames)"

	thread := parseBlock(t, "  native: #00 pc 0004df5c  /system/lib64/libc.so (syscall+28)", marker)

	if len(thread.Frames) != 2 {
		t.Fatalf("frames = %d, want 2", len(thread.Frames))
	}
	if got := thread.Frames[1].RawLine; got != marker {
		t.Errorf("last frame = %q, want %q", got, marker)
	}
	if len(thread.Trailer) != 0 {
		t.Errorf("trailer = %q, want none", thread.Trailer)
	}
}

func TestParseMultipleThreads(t *testing.T) {
	input := strings.Join([]string{
		"DALVIK THREADS (2):",
		`"main" prio=5 tid=1 Blocked`,
		anchorFrame,
		"",
		`"APP: Locker" daemon prio=5 tid=46 Sleeping`,
		anchorFrame,
	}, "\n")

	dump := Parse(input)

	if len(dump.Threads) != 2 {
		t.Fatalf("threads = %d, want 2", len(dump.Threads))
	}
	if dump.Threads[0].Name != "main" || dump.Threads[1].Name != "APP: Locker" {
		t.Errorf("threads = %q and %q, want main and APP: Locker",
			dump.Threads[0].Name, dump.Threads[1].Name)
	}
}

func TestParseDumpHeader(t *testing.T) {
	header := []string{
		`"quoted, but nothing ART would call a header`,
		"DALVIK THREADS (1):",
	}
	input := strings.Join(append(append([]string{}, header...), mainHeader, anchorFrame), "\n")

	dump := Parse(input)

	if !reflect.DeepEqual(dump.Header, header) {
		t.Errorf("header = %q, want %q", dump.Header, header)
	}
	if len(dump.Threads) != 1 {
		t.Errorf("threads = %d, want 1", len(dump.Threads))
	}
}

func TestParseDumpTrailer(t *testing.T) {
	trailer := []string{
		"Zygote loaded classes=29742 post zygote classes=8356",
		`"not a thread" and not a header`,
	}
	input := strings.Join(append([]string{mainHeader, anchorFrame, ""}, trailer...), "\n")

	dump := Parse(input)

	if len(dump.Threads) != 1 {
		t.Fatalf("threads = %d, want 1, the section must not reopen", len(dump.Threads))
	}
	if !reflect.DeepEqual(dump.Trailer, trailer) {
		t.Errorf("trailer = %q, want %q", dump.Trailer, trailer)
	}
}

func TestParseStopsAtUnknownThreadHeader(t *testing.T) {
	const odd = `" a shape ART has never printed`
	input := strings.Join([]string{mainHeader, anchorFrame, odd, anchorFrame}, "\n")

	dump := Parse(input)

	if len(dump.Threads) != 1 {
		t.Fatalf("threads = %d, want 1", len(dump.Threads))
	}
	if want := []string{odd, anchorFrame}; !reflect.DeepEqual(dump.Trailer, want) {
		t.Errorf("trailer = %q, want %q", dump.Trailer, want)
	}
}

func TestRenderRoundTrip(t *testing.T) {
	inputs := []string{
		"",
		"\n",
		"not a dump at all",
		"DALVIK THREADS (0):\n",
		threadDump(anchorFrame, "  - locked <0x1> (a java.lang.Object)", "DumpLatencyMs: 1.0", ""),
		threadDump("  native: #00 pc 0004df5c  /system/lib64/libc.so (syscall+28)"),
		// ART never prints a blank in the middle of a stack, but if it did
		// the lines below it would still come back in order.
		threadDump(anchorFrame, "", "  at java.lang.Thread.run(Thread.java:1012)"),
	}

	for _, input := range inputs {
		if got := Parse(input).Render(); got != input {
			t.Errorf("render changed %q at line %d", input, firstDiffLine(input, got))
		}
	}
}

func TestIsFrameworkClass(t *testing.T) {
	tests := []struct {
		class string
		want  bool
	}{
		{"java.lang.Object", true},
		{"javax.net.ssl.SSLSocket", true},
		{"jdk.internal.misc.Unsafe", true},
		{"sun.nio.ch.SocketChannelImpl", true},
		{"kotlin.coroutines.CoroutineContext", true},
		{"kotlinx.coroutines.DispatchedTask", true},
		{"android.os.Looper", true},
		{"androidx.work.Worker", true},
		{"com.android.internal.os.ZygoteInit", true},
		{"dalvik.system.VMStack", true},
		{"libcore.io.Linux", true},
		{"io.flutter.embedding.engine.FlutterEngine", true},
		{"com.facebook.react.bridge.NativeModule", true},
		{"sh.measure.android.Measure", true},
		{"sh.frankenstein.android.MainActivity", false},
		{"com.google.firebase.concurrent.CustomThreadFactory", false},
		// A bundled library ships inside the app, so its stall is the app's.
		{"okio.Buffer", false},
		// Still obfuscated, which is why task A5 symbolicates before marking:
		// this one deobfuscates to sh.measure and would then be framework.
		{"L0.b", false},
	}

	for _, tt := range tests {
		t.Run(tt.class, func(t *testing.T) {
			if got := isFrameworkClass(tt.class); got != tt.want {
				t.Errorf("isFrameworkClass(%q) = %v, want %v", tt.class, got, tt.want)
			}
		})
	}
}

func TestMarkInApp(t *testing.T) {
	dump := Parse(threadDump(
		"  at android.os.Looper.loop(Looper.java:1)",
		"  at sh.frankenstein.android.MainActivity.run(MainActivity.java:1)",
		"  native: #00 pc 0004df5c  /data/app/base.apk!/lib/arm64/libapp.so (???)",
	))

	dump.MarkInApp()

	frames := dump.Threads[0].Frames
	if frames[0].InApp {
		t.Error("framework frame marked as app")
	}
	if !frames[1].InApp {
		t.Error("app frame not marked as app")
	}
	if frames[2].InApp {
		t.Error("unparsed line marked as app")
	}
}

func TestParseFixture(t *testing.T) {
	for _, fixture := range []string{api33Dump, api36Dump} {
		t.Run(fixture, func(t *testing.T) {
			input := loadDump(t, fixture)

			dump := Parse(input)

			if got := dump.Render(); got != input {
				t.Fatalf("render changed the input at line %d", firstDiffLine(input, got))
			}
			if len(dump.Threads) == 0 {
				t.Fatal("parsed no threads")
			}
			// Every real thread prints a stack, so an empty one means the
			// parser stopped reading part way through the dump.
			for _, thread := range dump.Threads {
				if len(thread.Frames) == 0 {
					t.Errorf("thread %q has no frames", thread.Name)
				}
			}
		})
	}
}

func TestParseFixtureTrailer(t *testing.T) {
	input := loadDump(t, api33Dump)
	at := strings.Index(input, "\nZygote loaded classes=")
	if at < 0 {
		t.Fatal("fixture prints no runtime statistics")
	}

	dump := Parse(input)

	if got, want := strings.Join(dump.Trailer, "\n"), input[at+1:]; got != want {
		t.Errorf("trailer differs at line %d", firstDiffLine(want, got))
	}
	// The SDK trims the statistics away, so this one ends at its last thread.
	if got := Parse(loadDump(t, api36Dump)); len(got.Trailer) != 0 {
		t.Errorf("trailer = %q, want none", got.Trailer)
	}
}

func TestDeadlockInAPI36Fixture(t *testing.T) {
	dump := Parse(loadDump(t, api36Dump))

	stalled := threadNamed(t, dump, "main").Frames[0]
	if stalled.ClassName != "sh.frankenstein.android.AnrBroadcastReceiver" {
		t.Fatalf("main stalled in %s, want AnrBroadcastReceiver", stalled.ClassName)
	}
	contended := stalled.Locks[0]
	if contended.State != "waiting to lock" {
		t.Fatalf("main's lock = %+v, want it waiting to lock", contended)
	}

	holder := threadNamed(t, dump, "APP: Locker")
	if holder.Tid != contended.HolderTid {
		t.Fatalf("lock held by thread %d, but APP: Locker is thread %d",
			contended.HolderTid, holder.Tid)
	}

	held := false
	for _, frame := range holder.Frames {
		for _, lock := range frame.Locks {
			if lock.State == "locked" && lock.Object == contended.Object {
				held = true
			}
		}
	}
	if !held {
		t.Errorf("APP: Locker does not lock %s anywhere in its stack", contended.Object)
	}
}

func TestMainThread(t *testing.T) {
	dump := Parse(loadDump(t, "api36_deadlock.txt"))

	main := dump.MainThread()
	if main == nil {
		t.Fatal("got no main thread, want one")
	}
	if main.Name != "main" {
		t.Errorf("got thread %q, want %q", main.Name, "main")
	}
}

func TestMainThreadIsAbsent(t *testing.T) {
	dump := Parse(threadDump("  at sh.foo.Repo.load(Repo.kt:8)"))
	dump.Threads[0].Name = "msr-io"

	if main := dump.MainThread(); main != nil {
		t.Errorf("got thread %q, want none", main.Name)
	}
}

func TestMainThreadIsAddressable(t *testing.T) {
	dump := Parse(loadDump(t, "api36_deadlock.txt"))

	dump.MainThread().Frames[0].InApp = true

	if !threadNamed(t, dump, "main").Frames[0].InApp {
		t.Error("writing through MainThread did not reach the dump")
	}
}

func TestLockRenderNamesTheHolder(t *testing.T) {
	thread := parseBlock(t,
		"  at sh.foo.Repo.load(Repo.kt:8)",
		"  - waiting to lock <0x053dd6df> (a java.lang.Object) held by thread 46",
	)
	lock := thread.Frames[0].Locks[0]

	t.Run("Falls back to the thread id", func(t *testing.T) {
		want := "  - waiting to lock <0x053dd6df> (a java.lang.Object) held by thread 46"
		if got := lock.Render(""); got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	})

	t.Run("Uses the holder name when there is one", func(t *testing.T) {
		want := `  - waiting to lock <0x053dd6df> (a java.lang.Object) held by APP: Locker`
		if got := lock.Render("APP: Locker"); got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	})
}
