package artdump

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

const sampleDump = `DALVIK THREADS (5):
"main" prio=5 tid=1 Blocked
  at bl.o0.run(SourceFile:8)
  - waiting to lock <0x0e5c06d6> (a bl.o) held by thread 48
  at android.os.Handler.handleCallback(Handler.java:1089)
  at java.lang.reflect.Method.invoke(Native method)

"APP: Locker" prio=5 tid=48 Sleeping
  at java.lang.Thread.sleep(Unknown Source)
  - sleeping on <0x0d92ac5a> (a java.lang.Object)
  at bl.o0.run(SourceFile:29)
  - locked <@addr=0x207dee8> (a java.lang.Class<bl.o>)
  - locked <0x2239e38> (a bl.o[][])
  at b.c.d(SourceFile)
  at java.lang.Thread.run(Thread.java:1572)

"Waiter" prio=5 tid=7 Waiting
  at java.lang.Object.wait(Object.java:405)
  - waiting on an unknown object
  at rj.a.run(SourceFile:-2)
  - waiting for lock inflation of <0x0cd03f02> (a f.g)

"Signal Catcher" daemon prio=10 tid=2 Runnable
  (no managed stack frames)

"TracingMuxer" prio=10 (not attached)
  native: #00 pc 000d53c8  libc.so (__ppoll+8)`

func TestParse(t *testing.T) {
	d := Parse(sampleDump)
	if d == nil {
		t.Fatal("Parse returned nil")
	}

	want := [][]Frame{
		{
			{ClassName: "bl.o0", MethodName: "run", FileName: "SourceFile", LineNum: 8},
			{ClassName: "android.os.Handler", MethodName: "handleCallback", FileName: "Handler.java", LineNum: 1089},
		},
		{
			{ClassName: "java.lang.Thread", MethodName: "sleep", FileName: "", LineNum: 0},
			{ClassName: "bl.o0", MethodName: "run", FileName: "SourceFile", LineNum: 29},
			{ClassName: "b.c", MethodName: "d", FileName: "SourceFile", LineNum: 0},
			{ClassName: "java.lang.Thread", MethodName: "run", FileName: "Thread.java", LineNum: 1572},
		},
		{
			{ClassName: "java.lang.Object", MethodName: "wait", FileName: "Object.java", LineNum: 405},
			{ClassName: "rj.a", MethodName: "run", FileName: "SourceFile:-2", LineNum: 0},
		},
	}
	if got := d.Threads(); !reflect.DeepEqual(got, want) {
		t.Errorf("Threads:\ngot  %+v\nwant %+v", got, want)
	}

	wantClasses := []string{"bl.o", "java.lang.Object", "f.g"}
	if got := d.MonitorClasses(); !reflect.DeepEqual(got, wantClasses) {
		t.Errorf("MonitorClasses: got %v, want %v", got, wantClasses)
	}
}

func TestParseNoFrames(t *testing.T) {
	inputs := map[string]string{
		"empty":       "",
		"plain text":  "no frames here\njust text",
		"native only": "\"main\" prio=5 tid=1 Native\n  at a.b.c(Native method)",
	}
	for name, input := range inputs {
		if d := Parse(input); d != nil {
			t.Errorf("%s: Parse returned %+v, want nil", name, d)
		}
	}
}

func TestMainThread(t *testing.T) {
	t.Run("returns the frames of the main block", func(t *testing.T) {
		d := Parse(sampleDump)
		if d == nil {
			t.Fatal("Parse returned nil")
		}

		want := []Frame{
			{ClassName: "bl.o0", MethodName: "run", FileName: "SourceFile", LineNum: 8},
			{ClassName: "android.os.Handler", MethodName: "handleCallback", FileName: "Handler.java", LineNum: 1089},
		}
		if got := d.MainThread(); !reflect.DeepEqual(got, want) {
			t.Errorf("MainThread returned %+v, want %+v", got, want)
		}
	})

	t.Run("returns nothing when no block is named main", func(t *testing.T) {
		d := Parse("DALVIK THREADS (1):\n\"APP: Locker\" prio=5 tid=48 Sleeping\n  at bl.o0.run(SourceFile:29)")
		if d == nil {
			t.Fatal("Parse returned nil")
		}

		if got := d.MainThread(); got != nil {
			t.Errorf("MainThread returned %+v, want nil", got)
		}
	})
}

const sampleDumpRendered = `DALVIK THREADS (5):
"main" prio=5 tid=1 Blocked
  at com.example.Task.await(Task.kt:42)
  at com.example.DeadlockToken.acquire(Task.kt:18)
  - waiting to lock <0x0e5c06d6> (a com.example.DeadlockToken) held by thread 48
  at android.os.Handler.handleCallback(Handler.java:1089)
  at java.lang.reflect.Method.invoke(Native method)

"APP: Locker" prio=5 tid=48 Sleeping
  at java.lang.Thread.sleep(Unknown Source)
  - sleeping on <0x0d92ac5a> (a java.lang.Object)
  at com.example.Task.hold(Task.kt:77)
  - locked <@addr=0x207dee8> (a java.lang.Class<com.example.DeadlockToken>)
  - locked <0x2239e38> (a com.example.DeadlockToken[][])
  at com.example.Worker.d(SourceFile)
  at java.lang.Thread.run(Thread.java:1572)

"Waiter" prio=5 tid=7 Waiting
  at java.lang.Object.wait(Object.java:405)
  - waiting on an unknown object
  at rj.a.run(SourceFile:-2)
  - waiting for lock inflation of <0x0cd03f02> (a f.g)

"Signal Catcher" daemon prio=10 tid=2 Runnable
  (no managed stack frames)

"TracingMuxer" prio=10 (not attached)
  native: #00 pc 000d53c8  libc.so (__ppoll+8)`

func TestRender(t *testing.T) {
	d := Parse(sampleDump)
	if d == nil {
		t.Fatal("Parse returned nil")
	}

	rw := Rewrite{
		Frames: map[FrameKey][]Frame{
			// inline expansion: one frame renders as two lines
			{Thread: 0, Frame: 0}: {
				{ClassName: "com.example.Task", MethodName: "await", FileName: "Task.kt", LineNum: 42},
				{ClassName: "com.example.DeadlockToken", MethodName: "acquire", FileName: "Task.kt", LineNum: 18},
			},
			{Thread: 1, Frame: 1}: {
				{ClassName: "com.example.Task", MethodName: "hold", FileName: "Task.kt", LineNum: 77},
			},
		},
		Classes: map[string]string{
			"bl.o": "com.example.DeadlockToken",
			"b.c":  "com.example.Worker",
			"rj.a": "rj.a",
		},
	}

	if got := d.Render(rw); got != sampleDumpRendered {
		t.Errorf("Render:\ngot:\n%s\nwant:\n%s", got, sampleDumpRendered)
	}
}

func TestRenderIdentity(t *testing.T) {
	d := Parse(sampleDump)
	if d == nil {
		t.Fatal("Parse returned nil")
	}
	if got := d.Render(Rewrite{}); got != sampleDump {
		t.Errorf("empty rewrite must reproduce the input:\ngot:\n%s", got)
	}
}

func TestParseReal(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("testdata", "anr_real.txt"))
	if err != nil {
		t.Fatalf("read real dump: %v", err)
	}
	text := string(data)

	d := Parse(text)
	if d == nil {
		t.Fatal("Parse returned nil")
	}

	threads := d.Threads()
	if len(threads) != 27 {
		t.Errorf("threads: got %d, want 27", len(threads))
	}

	frames := 0
	for _, thread := range threads {
		frames += len(thread)
	}
	if frames != 174 {
		t.Errorf("frames: got %d, want 174", frames)
	}

	wantFirst := Frame{
		ClassName:  "bl.q0",
		MethodName: "run",
		FileName:   "r8-map-id-395c38ad35850b08fce2fc89e55363d510544d93c2dfa3e409521ade64f67e97",
		LineNum:    8,
	}
	if threads[0][0] != wantFirst {
		t.Errorf("main thread frame 0: got %+v, want %+v", threads[0][0], wantFirst)
	}

	wantClasses := []string{
		"bl.q",
		"java.lang.Object",
		"java.lang.ref.ReferenceQueue",
		"java.lang.Daemons$FinalizerWatchdogDaemon",
		"com.android.okhttp.ConnectionPool",
		"com.android.okhttp.okio.AsyncTimeout",
	}
	if got := d.MonitorClasses(); !reflect.DeepEqual(got, wantClasses) {
		t.Errorf("MonitorClasses: got %v, want %v", got, wantClasses)
	}

	if got := d.Render(Rewrite{}); got != text {
		t.Error("empty rewrite must reproduce the real dump unchanged")
	}
}
