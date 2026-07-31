package symbolicator

import (
	"testing"

	"backend/libs/event"
)

const sampleAppExitTrace = `DALVIK THREADS (3):
"main" prio=5 tid=1 Blocked
  at bl.o0.run(r8-map-id-abc123:8)
  - waiting to lock <0x0e5c06d6> (a java.lang.Object) held by thread 48
  at android.os.Handler.handleCallback(Handler.java:1089)
  at java.lang.reflect.Method.invoke(Native method)
DumpLatencyMs: 1.64917

"APP: Locker" prio=5 tid=48 Sleeping
  at java.lang.Thread.sleep(Unknown Source)
  at bl.o0.run(r8-map-id-abc123:29)
  - locked <0x0e5c06d6> (a java.lang.Object)
  at java.lang.Thread.run(Thread.java:1572)

"Signal Catcher" daemon prio=10 tid=2 Runnable
  (no managed stack frames)`

func TestParseAppExitTrace(t *testing.T) {
	parsed := parseAppExitTrace(sampleAppExitTrace)
	if parsed == nil {
		t.Fatal("parseAppExitTrace returned nil")
	}

	if len(parsed.threads) != 2 {
		t.Fatalf("threads: got %d, want 2", len(parsed.threads))
	}

	main := parsed.threads[0]
	if len(main.frames) != 2 {
		t.Fatalf("main thread frames: got %d, want 2 (native method frame must be skipped)", len(main.frames))
	}

	want := appExitFrame{lineIdx: 2, indent: "  ", className: "bl.o0", methodName: "run", fileName: "r8-map-id-abc123", lineNum: 8}
	if main.frames[0] != want {
		t.Errorf("main frame 0: got %+v, want %+v", main.frames[0], want)
	}

	want = appExitFrame{lineIdx: 4, indent: "  ", className: "android.os.Handler", methodName: "handleCallback", fileName: "Handler.java", lineNum: 1089}
	if main.frames[1] != want {
		t.Errorf("main frame 1: got %+v, want %+v", main.frames[1], want)
	}

	locker := parsed.threads[1]
	if len(locker.frames) != 3 {
		t.Fatalf("locker thread frames: got %d, want 3", len(locker.frames))
	}

	want = appExitFrame{lineIdx: 9, indent: "  ", className: "java.lang.Thread", methodName: "sleep", fileName: "", lineNum: 0}
	if locker.frames[0] != want {
		t.Errorf("locker frame 0: got %+v, want %+v", locker.frames[0], want)
	}

	if locker.frames[1].className != "bl.o0" || locker.frames[1].lineNum != 29 {
		t.Errorf("locker frame 1: got %+v", locker.frames[1])
	}

	if locker.frames[2].className != "java.lang.Thread" || locker.frames[2].methodName != "run" {
		t.Errorf("locker frame 2: got %+v", locker.frames[2])
	}

	for _, thread := range parsed.threads {
		if thread.stacktraceIdx != -1 {
			t.Errorf("stacktraceIdx: got %d, want -1 before request wiring", thread.stacktraceIdx)
		}
	}

	if len(parsed.monitors) != 2 {
		t.Fatalf("monitors: got %d, want 2", len(parsed.monitors))
	}
	wantMonitor := appExitMonitor{lineIdx: 3, className: "java.lang.Object"}
	if parsed.monitors[0] != wantMonitor {
		t.Errorf("monitor 0: got %+v, want %+v", parsed.monitors[0], wantMonitor)
	}
	wantMonitor = appExitMonitor{lineIdx: 11, className: "java.lang.Object"}
	if parsed.monitors[1] != wantMonitor {
		t.Errorf("monitor 1: got %+v, want %+v", parsed.monitors[1], wantMonitor)
	}
}

// TestAppExitMonitorRe pins the annotation forms the regex must
// match. Rows are real lines from testdata/jvm_app_exit_input.json,
// except the lock inflation verb, which cannot be provoked on
// demand and comes from ART's StackDumpVisitor.
func TestAppExitMonitorRe(t *testing.T) {
	cases := []struct {
		line      string
		wantClass string
	}{
		{`  - waiting to lock <0x0cd03f02> (a bl.q) held by thread 21`, "bl.q"},
		{`  - waiting on <0x04964405> (a bl.q)`, "bl.q"},
		{`  - locked <0x04964405> (a bl.q)`, "bl.q"},
		{`  - sleeping on <0x0d92ac5a> (a java.lang.Object)`, "java.lang.Object"},
		{`  - locked <@addr=0x207dee8> (a java.lang.Class<bl.q>)`, "java.lang.Class<bl.q>"},
		{`  - locked <@addr=0x2239e38> (a bl.q[])`, "bl.q[]"},
		{`  - waiting on <0x08802c49> (a java.lang.Class<java.lang.ref.ReferenceQueue>)`, "java.lang.Class<java.lang.ref.ReferenceQueue>"},
		{`  - waiting for lock inflation of <0x0cd03f02> (a bl.q) held by thread 21`, "bl.q"},
		{`  - waiting on an unknown object`, ""},
		{`  at bl.q.a(SourceFile:8)`, ""},
	}
	for _, c := range cases {
		got := ""
		if m := appExitMonitorRe.FindStringSubmatch(c.line); m != nil {
			got = m[2]
		}
		if got != c.wantClass {
			t.Errorf("monitor class of %q: got %q, want %q", c.line, got, c.wantClass)
		}
	}

	heldBy := `  - waiting to lock <0x0cd03f02> (a bl.q) held by thread 21`
	m := appExitMonitorRe.FindStringSubmatch(heldBy)
	if m == nil || m[1] != "waiting to lock" || m[3] != "21" {
		t.Errorf("verb and holder of %q: got %v, want verb %q and thread %q", heldBy, m, "waiting to lock", "21")
	}
}

func TestSplitAppExitMonitorClass(t *testing.T) {
	cases := []struct {
		objType   string
		prefix    string
		className string
		suffix    string
	}{
		{"bl.q", "", "bl.q", ""},
		{"java.lang.Class<bl.q>", "java.lang.Class<", "bl.q", ">"},
		{"bl.q[]", "", "bl.q", "[]"},
		{"bl.q[][]", "", "bl.q", "[][]"},
		{"java.lang.Class<bl.q[]>", "java.lang.Class<", "bl.q", "[]>"},
	}
	for _, c := range cases {
		prefix, className, suffix := splitAppExitMonitorClass(c.objType)
		if prefix != c.prefix || className != c.className || suffix != c.suffix {
			t.Errorf("splitAppExitMonitorClass(%q): got (%q, %q, %q), want (%q, %q, %q)",
				c.objType, prefix, className, suffix, c.prefix, c.className, c.suffix)
		}
	}
}

func TestParseAppExitTrace_NoFrames(t *testing.T) {
	for _, trace := range []string{"", "a.b.c", "DALVIK THREADS (1):\n\"main\" prio=5 tid=1 Runnable\n  (no managed stack frames)"} {
		if parsed := parseAppExitTrace(trace); parsed != nil {
			t.Errorf("parseAppExitTrace(%q): got %+v, want nil", trace, parsed)
		}
	}
}

// TestAppExitRebuild verifies the three rewrite behaviors in one
// pass: a plain one-to-one frame rewrite, an inline expansion where
// one request frame comes back as two lines, and frames omitted
// from the response keeping their original line. Non-frame lines
// must pass through byte-identical.
func TestAppExitRebuild(t *testing.T) {
	parsed := parseAppExitTrace(sampleAppExitTrace)
	if parsed == nil {
		t.Fatal("parseAppExitTrace returned nil")
	}
	parsed.threads[0].stacktraceIdx = 0
	parsed.threads[1].stacktraceIdx = 1

	resp := &responseJVM{
		Status: "completed",
		Stacktraces: []stacktraceJVM{
			{Frames: []frameJVM{
				{Function: "triggerAnr", Filename: "ANRDemoActivity.kt", Module: "sh.measure.sample.ANRDemoActivity", LineNo: 50, Index: 0},
				{Function: "handleCallback", Filename: "Handler.java", Module: "android.os.Handler", LineNo: 1089, Index: 1},
			}},
			{Frames: []frameJVM{
				{Function: "outer", Filename: "Foo.kt", Module: "com.example.Foo", LineNo: 100, Index: 1},
				{Function: "inner", Filename: "Foo.kt", Module: "com.example.Foo", LineNo: 200, Index: 1},
			}},
		},
		Classes: map[string]string{},
	}

	got := parsed.rebuild(resp, false)

	want := `DALVIK THREADS (3):
"main" prio=5 tid=1 Blocked
  at sh.measure.sample.ANRDemoActivity.triggerAnr(ANRDemoActivity.kt:50)
  - waiting to lock <0x0e5c06d6> (a java.lang.Object) held by thread 48
  at android.os.Handler.handleCallback(Handler.java:1089)
  at java.lang.reflect.Method.invoke(Native method)
DumpLatencyMs: 1.64917

"APP: Locker" prio=5 tid=48 Sleeping
  at java.lang.Thread.sleep(Unknown Source)
  at com.example.Foo.outer(Foo.kt:100)
  at com.example.Foo.inner(Foo.kt:200)
  - locked <0x0e5c06d6> (a java.lang.Object)
  at java.lang.Thread.run(Thread.java:1572)

"Signal Catcher" daemon prio=10 tid=2 Runnable
  (no managed stack frames)`

	if got != want {
		t.Errorf("rebuild mismatch\ngot:\n%s\n\nwant:\n%s", got, want)
	}
}

// TestRewriteAppExits_EventTypeSplit verifies the rebuilt trace
// lands in ANR.ThreadDump for anr events and in AppExit.Trace for
// app_exit events sharing one symbolication batch.
func TestRewriteAppExits_EventTypeSplit(t *testing.T) {
	trace := `"main" prio=5 tid=1 Blocked
  at bl.o0.run(SourceFile:8)`

	anrParsed := parseAppExitTrace(trace)
	exitParsed := parseAppExitTrace(trace)
	if anrParsed == nil || exitParsed == nil {
		t.Fatal("parseAppExitTrace returned nil")
	}

	js := jvmSymbolicator{
		response: &responseJVM{
			Status:  "completed",
			Classes: map[string]string{"bl.o0": "com.example.Locker"},
		},
		appExitTraces: map[int]*appExitTrace{
			0: anrParsed,
			1: exitParsed,
		},
	}

	evs := []event.EventField{
		{Type: event.TypeANR, ANR: &event.ANR{ThreadDump: trace}},
		{Type: event.TypeAppExit, AppExit: &event.AppExit{Trace: trace}},
	}

	js.rewriteAppExits(evs, false)

	want := `"main" prio=5 tid=1 Blocked
  at com.example.Locker.run(SourceFile:8)`
	if evs[0].ANR.ThreadDump != want {
		t.Errorf("anr thread dump: got:\n%s\n\nwant:\n%s", evs[0].ANR.ThreadDump, want)
	}
	if evs[1].AppExit.Trace != want {
		t.Errorf("app_exit trace: got:\n%s\n\nwant:\n%s", evs[1].AppExit.Trace, want)
	}
}

func TestAppExitRebuild_NoResponse(t *testing.T) {
	parsed := parseAppExitTrace(sampleAppExitTrace)
	if parsed == nil {
		t.Fatal("parseAppExitTrace returned nil")
	}

	got := parsed.rebuild(&responseJVM{Status: "completed"}, false)
	if got != sampleAppExitTrace {
		t.Errorf("rebuild without matching stacktraces must return the original trace\ngot:\n%s", got)
	}
}

// TestAppExitRebuild_ClassFallback covers the class-name-only
// rewrites: a frame symbolicator dropped from the response (R8
// synthesized) falls back to the classes map keeping its original
// method and location, and monitor annotation lines get their
// object class rewritten from the same map.
func TestAppExitRebuild_ClassFallback(t *testing.T) {
	trace := `"main" prio=5 tid=1 Blocked
  at bl.o0.run(SourceFile:8)
  - waiting to lock <0x0e5c06d6> (a ye.e) held by thread 48
  at bl.o0.a(SourceFile:147)`

	parsed := parseAppExitTrace(trace)
	if parsed == nil {
		t.Fatal("parseAppExitTrace returned nil")
	}
	parsed.threads[0].stacktraceIdx = 0

	resp := &responseJVM{
		Status: "completed",
		Stacktraces: []stacktraceJVM{
			{Frames: []frameJVM{
				{Function: "run", Filename: "Locker.kt", Module: "com.example.Locker", LineNo: 29, Index: 0},
			}},
		},
		Classes: map[string]string{
			"bl.o0": "com.example.Locker",
			"ye.e":  "com.example.LockHolder",
		},
	}

	got := parsed.rebuild(resp, false)
	want := `"main" prio=5 tid=1 Blocked
  at com.example.Locker.run(Locker.kt:29)
  - waiting to lock <0x0e5c06d6> (a com.example.LockHolder) held by thread 48
  at com.example.Locker.a(SourceFile:147)`
	if got != want {
		t.Errorf("rebuild mismatch\ngot:\n%s\n\nwant:\n%s", got, want)
	}
}

func TestAppExitRebuild_LambdaWorkaround(t *testing.T) {
	trace := `"main" prio=5 tid=1 Blocked
  at bl.o0.run(SourceFile:8)`

	resp := &responseJVM{
		Status: "completed",
		Stacktraces: []stacktraceJVM{
			{Frames: []frameJVM{
				{Function: "run", Filename: "SourceFile", Module: "J3.Demo$$InternalSyntheticLambda$1", LineNo: 20, Index: 0},
			}},
		},
		Classes: map[string]string{"bl.o0": "com.example.Demo$$ExternalSyntheticLambda2"},
	}

	parsed := parseAppExitTrace(trace)
	if parsed == nil {
		t.Fatal("parseAppExitTrace returned nil")
	}
	parsed.threads[0].stacktraceIdx = 0
	got := parsed.rebuild(resp, true)
	want := `"main" prio=5 tid=1 Blocked
  at com.example.Demo$$ExternalSyntheticLambda2.run(SourceFile:20)`
	if got != want {
		t.Errorf("lambda workaround on: got\n%s\nwant\n%s", got, want)
	}

	parsed = parseAppExitTrace(trace)
	if parsed == nil {
		t.Fatal("parseAppExitTrace returned nil")
	}
	parsed.threads[0].stacktraceIdx = 0
	got = parsed.rebuild(resp, false)
	want = `"main" prio=5 tid=1 Blocked
  at J3.Demo$$InternalSyntheticLambda$1.run(SourceFile:20)`
	if got != want {
		t.Errorf("lambda workaround off: got\n%s\nwant\n%s", got, want)
	}
}
