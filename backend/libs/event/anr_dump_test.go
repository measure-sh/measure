package event

import (
	"crypto/md5"
	"encoding/hex"
	"os"
	"reflect"
	"strings"
	"testing"

	"backend/libs/artdump"
)

// Subjects in the shapes the SDK sends. On newer Android the SDK sends
// the subject line from the trace. Android 12 and older don't write that
// line, so the SDK sends the exit description instead. AOSP leaves that
// as the bare kill reason, and ColorOS puts the kill reason in front of
// the subject. OnePlus raises its own ANR with a subject the grouping
// doesn't recognise.
const (
	inputSubject     = "Input dispatching timed out (7e1b6d2 sh.foo/sh.foo.MainActivity (server) is not responding. Waited 5001ms for MotionEvent)"
	broadcastSubject = "user request after error:Broadcast of Intent { flg=0x10000010 cmp=sh.foo/.Receiver }"
	oemSubject       = "MainThread worked timeout"
)

// dumpANR runs the same steps as ingest, so tests see what the dashboard
// sees. An empty dump stands for a row read without its dump.
func dumpANR(subject, dump string) ANR {
	anr := ANR{Subject: subject, RawThreadDump: dump}
	if dump == "" {
		return anr
	}

	anr.ThreadDump = artdump.Parse(dump)
	anr.ThreadDump.Populate()
	return anr
}

func fingerprintOf(t *testing.T, anr ANR) string {
	t.Helper()
	if err := anr.ComputeFingerprint(); err != nil {
		t.Fatalf("Unexpected error computing fingerprint: %v", err)
	}
	return anr.Fingerprint
}

func hashOf(key string) string {
	hash := md5.Sum([]byte(key))
	return hex.EncodeToString(hash[:])
}

func TestANRDumpFingerprint(t *testing.T) {
	tests := []struct {
		name    string
		subject string
		dump    string
		// key is what the fingerprint hashes. Rows that should land in
		// one group share a key.
		key string
	}{
		{
			name:    "Groups on the first app frame when nothing blocks main",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Runnable
  at android.os.MessageQueue.next(MessageQueue.java:335)
  at sh.foo.Repo.load(Repo.kt:8)`,
			key: "art#sh.foo.Repo:load:Repo.kt",
		},
		{
			name:    "Ignores line numbers",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Runnable
  at android.os.MessageQueue.next(MessageQueue.java:335)
  at sh.foo.Repo.load(Repo.kt:80)`,
			key: "art#sh.foo.Repo:load:Repo.kt",
		},
		{
			name:    "Leaves the subject out when the frame is app code",
			subject: broadcastSubject,
			dump: `"main" prio=5 tid=1 Runnable
  at android.os.MessageQueue.next(MessageQueue.java:335)
  at sh.foo.Repo.load(Repo.kt:8)`,
			key: "art#sh.foo.Repo:load:Repo.kt",
		},
		{
			name:    "Groups on the app code holding the lock main waits for",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"pool-1-thread-1" daemon prio=5 tid=21 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.foo.Cache.refresh(Cache.kt:88)
  - locked <0x0cd03f02> (a java.lang.Object)`,
			key: "art#sh.foo.Cache:refresh:Cache.kt",
		},
		{
			name:    "Groups another call site blocked by the same code together",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Blocked
  at sh.foo.Settings.save(Settings.kt:64)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"pool-1-thread-1" daemon prio=5 tid=21 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.foo.Cache.refresh(Cache.kt:88)
  - locked <0x0cd03f02> (a java.lang.Object)`,
			key: "art#sh.foo.Cache:refresh:Cache.kt",
		},
		{
			name:    "Ignores the name and tid of the thread holding the lock",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 22

"pool-2-thread-3" daemon prio=5 tid=22 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.foo.Cache.refresh(Cache.kt:88)
  - locked <0x0cd03f02> (a java.lang.Object)`,
			key: "art#sh.foo.Cache:refresh:Cache.kt",
		},
		{
			name:    "Separates the same call site blocked by different code",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"pool-1-thread-1" daemon prio=5 tid=21 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.foo.Uploader.flush(Uploader.kt:17)
  - locked <0x0cd03f02> (a java.lang.Object)`,
			key: "art#sh.foo.Uploader:flush:Uploader.kt",
		},
		{
			name:    "Groups on app code partway along the chain when the last thread has none",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Blocked
  at android.os.Handler.dispatchMessage(Handler.java:110)
  - waiting to lock <0x0aaa0001> (a java.lang.Object) held by thread 21

"worker" daemon prio=5 tid=21 Blocked
  at sh.foo.Importer.run(Importer.kt:41)
  - waiting to lock <0x0bbb0002> (a java.lang.Object) held by thread 22

"Binder:1_2" prio=5 tid=22 Native
  at android.os.BinderProxy.transactNative(Native method)
  - locked <0x0bbb0002> (a java.lang.Object)`,
			key: "art#sh.foo.Importer:run:Importer.kt",
		},
		{
			name:    "Falls back to main's app code when the lock holder runs none",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"Binder:1_2" prio=5 tid=21 Native
  at android.os.BinderProxy.transactNative(Native method)
  - locked <0x0cd03f02> (a java.lang.Object)`,
			key: "art#sh.foo.Screen:render:Screen.kt",
		},
		{
			name:    "Adds the timeout and component when no app code is involved",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Native
  at android.os.MessageQueue.nativePollOnce(Native method)
  at android.os.Looper.loopOnce(Looper.java:161)`,
			key: "art#Input dispatching timed out:sh.foo/sh.foo.MainActivity:android.os.MessageQueue:nativePollOnce:Native method",
		},
		{
			name:    "Uses main's first frame when no thread in the chain runs app code",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Blocked
  at android.os.MessageQueue.nativePollOnce(Native method)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"Binder:1_2" prio=5 tid=21 Native
  at android.os.BinderProxy.transactNative(Native method)
  - locked <0x0cd03f02> (a java.lang.Object)`,
			key: "art#Input dispatching timed out:sh.foo/sh.foo.MainActivity:android.os.MessageQueue:nativePollOnce:Native method",
		},
		{
			name:    "Reads the subject inside the exit description",
			subject: broadcastSubject,
			dump: `"main" prio=5 tid=1 Native
  at android.os.MessageQueue.nativePollOnce(Native method)`,
			key: "art#Broadcast of Intent:sh.foo/.Receiver:android.os.MessageQueue:nativePollOnce:Native method",
		},
		{
			name:    "Groups the same subject without the exit description together",
			subject: strings.TrimPrefix(broadcastSubject, "user request after error:"),
			dump: `"main" prio=5 tid=1 Native
  at android.os.MessageQueue.nativePollOnce(Native method)`,
			key: "art#Broadcast of Intent:sh.foo/.Receiver:android.os.MessageQueue:nativePollOnce:Native method",
		},
		{
			name:    "Uses the frame alone for a subject it doesn't recognise",
			subject: oemSubject,
			dump: `"main" prio=5 tid=1 Native
  at android.os.MessageQueue.nativePollOnce(Native method)`,
			key: "art#android.os.MessageQueue:nativePollOnce:Native method",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			anr := dumpANR(tt.subject, tt.dump)

			if got := anr.dumpFingerprintData(); got != tt.key {
				t.Fatalf("Expected key %q, but got %q", tt.key, got)
			}

			if got, want := fingerprintOf(t, anr), hashOf(tt.key); got != want {
				t.Errorf("Expected fingerprint %q, but got %q", want, got)
			}
		})
	}
}

func TestANRDumpFingerprintNeverCollidesWithAnExceptionFingerprint(t *testing.T) {
	legacy := ANR{
		Exceptions: ExceptionUnits{
			{Type: "art", Frames: Frames{{MethodName: "load", FileName: "Repo.kt"}}},
		},
	}
	dump := dumpANR(inputSubject, `"main" prio=5 tid=1 Runnable
  at sh.foo.Repo.load(Repo.kt:8)`)

	if got, other := fingerprintOf(t, legacy), fingerprintOf(t, dump); got == other {
		t.Errorf("Expected different fingerprints, both were %q", got)
	}
}

func TestANRDumpAccessors(t *testing.T) {
	tests := []struct {
		name    string
		subject string
		// dump is empty for a row read without its dump, which is what
		// the reproduction steps query does.
		dump       string
		wantType   string
		wantFile   string
		wantMethod string
		wantLine   int32
		wantTitle  string
		noFrames   bool
	}{
		{
			name:    "Reports the first app frame",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Runnable
  at android.os.MessageQueue.next(MessageQueue.java:335)
  at sh.foo.Repo.load(Repo.kt:8)`,
			wantType:   artdump.CauseSlowOperation,
			wantFile:   "Repo.kt",
			wantMethod: "load",
			wantLine:   8,
			wantTitle:  artdump.CauseSlowOperation + "@Repo.kt",
		},
		{
			name:    "Reports the app code holding the lock",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"pool-1-thread-1" daemon prio=5 tid=21 Sleeping
  at sh.foo.Cache.refresh(Cache.kt:88)
  - locked <0x0cd03f02> (a java.lang.Object)`,
			wantType:   artdump.CauseBlocked,
			wantFile:   "Cache.kt",
			wantMethod: "refresh",
			wantLine:   88,
			wantTitle:  artdump.CauseBlocked + "@Cache.kt",
		},
		{
			name:    "Reports line zero for a frame without a line",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Native
  at android.os.MessageQueue.nativePollOnce(Native method)`,
			wantType:   artdump.CauseIdle,
			wantFile:   "Native method",
			wantMethod: "nativePollOnce",
			wantLine:   0,
			wantTitle:  artdump.CauseIdle + "@Native method",
		},
		{
			name:    "Reports the dump's cause for a subject it doesn't recognise",
			subject: oemSubject,
			dump: `"main" prio=5 tid=1 Runnable
  at sh.foo.Repo.load(Repo.kt:8)`,
			wantType:   artdump.CauseSlowOperation,
			wantFile:   "Repo.kt",
			wantMethod: "load",
			wantLine:   8,
			wantTitle:  artdump.CauseSlowOperation + "@Repo.kt",
		},
		{
			name:    "Reports no frame when main has no managed frames",
			subject: inputSubject,
			dump: `"main" prio=5 tid=1 Native
  (no managed stack frames)`,
			wantType:  artdump.CauseSlowOperation,
			wantTitle: artdump.CauseSlowOperation,
			noFrames:  true,
		},
		{
			// A client can send any text, and ingest must not panic on it.
			name:    "Reports no type or frame for a dump without a main thread",
			subject: inputSubject,
			dump: `"msr-io" daemon prio=5 tid=12 Waiting
  at sh.foo.Repo.load(Repo.kt:8)`,
			noFrames: true,
		},
		{
			name:     "Reports only the subject without the dump",
			subject:  inputSubject,
			noFrames: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			anr := dumpANR(tt.subject, tt.dump)

			if got := anr.GetType(); got != tt.wantType {
				t.Errorf("Expected type %q, but got %q", tt.wantType, got)
			}
			if got := anr.GetMessage(); got != tt.subject {
				t.Errorf("Expected the subject as the message, but got %q", got)
			}
			if got := anr.GetFileName(); got != tt.wantFile {
				t.Errorf("Expected file name %q, but got %q", tt.wantFile, got)
			}
			if got := anr.GetMethodName(); got != tt.wantMethod {
				t.Errorf("Expected method name %q, but got %q", tt.wantMethod, got)
			}
			if got := anr.GetLineNumber(); got != tt.wantLine {
				t.Errorf("Expected line number %d, but got %d", tt.wantLine, got)
			}
			if got := anr.GetDisplayTitle(); got != tt.wantTitle {
				t.Errorf("Expected display title %q, but got %q", tt.wantTitle, got)
			}
			if got := anr.HasNoFrames(); got != tt.noFrames {
				t.Errorf("Expected HasNoFrames %v, but got %v", tt.noFrames, got)
			}
		})
	}
}

func TestANRView(t *testing.T) {
	tests := []struct {
		name         string
		dump         string
		blamedThread string
		cause        string
		stacktrace   []string
		threads      []ThreadView
	}{
		{
			name: "Blames the thread holding the lock",
			dump: `"main" prio=5 tid=1 Blocked
  at sh.foo.Repo.load(Repo.kt:8)
  - waiting to lock <0x053dd6df> (a java.lang.Object) held by thread 46
DumpLatencyMs: 2.47

"APP: Locker" daemon prio=5 tid=46 Sleeping
  at java.lang.Thread.sleep(Native method)
  - sleeping on <0x07c5c2d7> (a java.lang.Object)
  native: #00 pc 0004df5c  /apex/libc.so (syscall+28)`,
			blamedThread: `"APP: Locker" daemon prio=5 tid=46 Sleeping`,
			cause:        artdump.CauseBlocked,
			stacktrace: []string{
				`"APP: Locker" daemon prio=5 tid=46 Sleeping`,
				"  at java.lang.Thread.sleep(Native method)",
				"  - sleeping on <0x07c5c2d7> (a java.lang.Object)",
				"  native: #00 pc 0004df5c  /apex/libc.so (syscall+28)",
			},
			threads: []ThreadView{{
				Name: `"main" prio=5 tid=1 Blocked`,
				Frames: []string{
					"  at sh.foo.Repo.load(Repo.kt:8)",
					"  - waiting to lock <0x053dd6df> (a java.lang.Object) held by thread 46",
				},
			}},
		},
		{
			name: "Blames main when nothing blocks it",
			dump: `"main" prio=5 tid=1 Runnable
  at sh.foo.Repo.load(Repo.kt:8)

"msr-io" daemon prio=5 tid=12 Waiting
  at java.lang.Object.wait(Native method)`,
			blamedThread: `"main" prio=5 tid=1 Runnable`,
			cause:        artdump.CauseSlowOperation,
			stacktrace: []string{
				`"main" prio=5 tid=1 Runnable`,
				"  at sh.foo.Repo.load(Repo.kt:8)",
			},
			threads: []ThreadView{{
				Name:   `"msr-io" daemon prio=5 tid=12 Waiting`,
				Frames: []string{"  at java.lang.Object.wait(Native method)"},
			}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := EventANR{ANR: dumpANR(inputSubject, tt.dump)}
			e.ComputeView()

			if got := e.ANRView.BlamedThread; got != tt.blamedThread {
				t.Errorf("Expected blamed thread %q, but got %q", tt.blamedThread, got)
			}
			if got := e.ANRView.Cause; got != tt.cause {
				t.Errorf("Expected cause %q, but got %q", tt.cause, got)
			}
			if got, want := e.ANRView.Stacktrace, strings.Join(tt.stacktrace, "\n"); got != want {
				t.Errorf("Expected stacktrace:\n%s\ngot:\n%s", want, got)
			}
			if !reflect.DeepEqual(e.Threads, tt.threads) {
				t.Errorf("Expected threads %+v, but got %+v", tt.threads, e.Threads)
			}
		})
	}
}

func TestANRViewKeepsTheExceptionShape(t *testing.T) {
	legacy := EventANR{ANR: ANR{
		Exceptions: ExceptionUnits{{Type: "AppNotResponding"}},
		Threads: Threads{{
			Name:   "main",
			Frames: Frames{{ClassName: "sh.foo.Repo", MethodName: "load", FileName: "Repo.kt", LineNum: 8}},
		}},
	}}
	legacy.ComputeView()

	if len(legacy.Threads) != 1 {
		t.Fatalf("Expected 1 thread, but got %d", len(legacy.Threads))
	}
	if got, want := legacy.Threads[0].Name, "main"; got != want {
		t.Errorf("Expected thread name %q, but got %q", want, got)
	}
	if legacy.ANRView.Subject != "" {
		t.Errorf("Expected no subject, but got %q", legacy.ANRView.Subject)
	}
	if legacy.ANRView.BlamedThread != "" {
		t.Errorf("Expected no blamed thread, but got %q", legacy.ANRView.BlamedThread)
	}
	if legacy.ANRView.Cause != "" {
		t.Errorf("Expected no cause, but got %q", legacy.ANRView.Cause)
	}
}

func TestANRDumpFingerprintSubjectComponent(t *testing.T) {
	cases := []struct {
		name    string
		subject string
		key     string
	}{
		{
			"Reads the receiver a broadcast was sent to",
			"Broadcast of Intent { flg=0x10080010 cmp=sh.foo/.Receiver }",
			"art#Broadcast of Intent:sh.foo/.Receiver",
		},
		{
			"Reads the action of a broadcast sent to no component",
			"Broadcast of Intent { act=android.intent.action.SCREEN_ON flg=0x50200010 }",
			"art#Broadcast of Intent:android.intent.action.SCREEN_ON",
		},
		{
			"Prefers the component over the action",
			"Broadcast of Intent { act=sh.foo.SYNC flg=0x10 cmp=sh.foo/.SyncReceiver }",
			"art#Broadcast of Intent:sh.foo/.SyncReceiver",
		},
		{
			"Reads the service that missed its deadline",
			"executing service sh.foo/.SyncService",
			"art#executing service:sh.foo/.SyncService",
		},
		{
			"Reads the activity from an input dispatch timeout",
			"Input dispatching timed out (6669d70 sh.foo/sh.foo.MainActivity (server) is not responding. Waited 5005ms for MotionEvent)",
			"art#Input dispatching timed out:sh.foo/sh.foo.MainActivity",
		},
		{
			"Reads through the kill description",
			"user request after error:Broadcast of Intent { flg=0x10080010 cmp=sh.foo/.Receiver }",
			"art#Broadcast of Intent:sh.foo/.Receiver",
		},
		{
			"Names nothing for an unfocused window",
			"Input dispatching timed out (Application does not have a focused window)",
			"art#Input dispatching timed out",
		},
		{
			"Names nothing for a process that did not finish starting",
			"Process ProcessRecord{3f8a2b1 12345:sh.foo/u0a123} failed to complete startup",
			"art#failed to complete startup",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			anr := dumpANR(c.subject, `"main" prio=5 tid=1 Native
  (no managed stack frames)`)

			if got := anr.dumpFingerprintData(); got != c.key {
				t.Errorf("Expected key %q, but got %q", c.key, got)
			}
		})
	}
}

func TestANRDumpFingerprintSubjectCategory(t *testing.T) {
	cases := []struct {
		name    string
		subject string
		key     string
	}{
		{
			"Recognises an input dispatch timeout",
			"Input dispatching timed out (6669d70 sh.foo/sh.foo.MainActivity (server) is not responding. Waited 5005ms for MotionEvent)",
			"art#Input dispatching timed out:sh.foo/sh.foo.MainActivity",
		},
		{
			"Recognises a broadcast timeout",
			"Broadcast of Intent { flg=0x10080010 cmp=sh.foo/.Receiver }",
			"art#Broadcast of Intent:sh.foo/.Receiver",
		},
		{"Recognises a service timeout", "executing service sh.foo/.SyncService", "art#executing service:sh.foo/.SyncService"},
		{"Recognises a content provider timeout", "ContentProvider not responding", "art#ContentProvider not responding"},
		{
			"Recognises a foreground service that never started",
			"Context.startForegroundService() did not then call Service.startForeground(): ServiceRecord{2d3f1a u0 sh.foo/.PlayerService}",
			"art#Context.startForegroundService() did not then call Service.startForeground():sh.foo/.PlayerService",
		},
		{"Recognises an ANR the app asked for", "App requested: Buggy callback", "art#App requested"},
		{"Recognises a job that did not start", "No response to onStartJob", "art#No response to onStartJob"},
		{"Recognises a job that did not stop", "No response to onStopJob", "art#No response to onStopJob"},
		{"Recognises a job service that did not bind", "Timed out while trying to bind", "art#Timed out while trying to bind"},
		{
			"Recognises a process that did not finish starting",
			"Process ProcessRecord{3f8a2b1 12345:sh.foo/u0a123} failed to complete startup",
			"art#failed to complete startup",
		},
		{
			"Recognises a subject inside the exit description",
			"user request after error:Broadcast of Intent { flg=0x10080010 cmp=sh.foo/.Receiver }",
			"art#Broadcast of Intent:sh.foo/.Receiver",
		},
		// OnePlus raises its own ANR for a busy main thread.
		{"Does not recognise an OEM subject", "MainThread worked timeout", ""},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			anr := dumpANR(c.subject, `"main" prio=5 tid=1 Native
  (no managed stack frames)`)

			if got := anr.dumpFingerprintData(); got != c.key {
				t.Errorf("Expected key %q, but got %q", c.key, got)
			}
		})
	}
}

// TestANRFromARealDump runs a real dump through the same steps as ingest
// and checks what the dashboard would show.
func TestANRFromARealDump(t *testing.T) {
	dump, err := os.ReadFile("../artdump/testdata/api36_deadlock.txt")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	const subject = "Broadcast of Intent { flg=0x10000010 xflg=0x4 cmp=sh.frankenstein.android/.AnrBroadcastReceiver }"
	anr := dumpANR(subject, string(dump))

	t.Run("Groups on the app code holding the lock", func(t *testing.T) {
		want := hashOf("art#sh.frankenstein.android.AnrBroadcastReceiver$Companion:trigger$lambda$0:AnrBroadcastReceiver.kt")
		if got := fingerprintOf(t, anr); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Titles the group by the cause and the file", func(t *testing.T) {
		if got, want := anr.GetDisplayTitle(), artdump.CauseBlocked+"@AnrBroadcastReceiver.kt"; got != want {
			t.Errorf("Expected display title %q, but got %q", want, got)
		}
	})

	t.Run("Shows the thread holding the lock first", func(t *testing.T) {
		e := EventANR{ANR: anr}
		e.ComputeView()

		if got, want := e.ANRView.BlamedThread, `"APP: Locker" daemon prio=5 tid=46 Sleeping`; got != want {
			t.Errorf("Expected blamed thread %q, but got %q", want, got)
		}
		if got, want := e.Threads[0].Name, `"main" prio=5 tid=1 Blocked`; got != want {
			t.Errorf("Expected the stalled thread next, but got %q", got)
		}
	})
}
