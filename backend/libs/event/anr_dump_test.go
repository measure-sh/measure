package event

import (
	"crypto/md5"
	"encoding/hex"
	"reflect"
	"slices"
	"strings"
	"testing"

	"backend/libs/artdump"
)

// The subjects ApplicationExitInfo reports, in the two shapes the SDK
// can send: bare from the trace, and wrapped by the kill description.
const (
	inputSubject     = "user request after error: Input dispatching timed out (7e1b6d2 sh.foo/.MainActivity is not responding. Waited 5001ms for MotionEvent)"
	broadcastSubject = "user request after error: Broadcast of Intent { flg=0x10000010 cmp=sh.foo/.Receiver }"
	unknownSubject   = "the process ended for reasons this parser does not recognise"
)

// Thread dumps, smallest first. Every one is a whole dump, so a test
// reads the exact input it asserts on.
const (
	// Nothing blocks the stalled thread, which runs app code below two
	// framework frames and one native frame.
	inAppStall = `"main" prio=5 tid=1 Blocked
  native: #00 pc 0004df5c  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+28)
  at android.os.MessageQueue.nativePollOnce(Native method)
  at sh.foo.Repo.load(Repo.kt:8)
  at android.app.ActivityThread.main(ActivityThread.java:8280)`

	// Parked in the looper, which is what an ANR that did not stall the
	// main thread looks like.
	idleMain = `"main" prio=5 tid=1 Native
  at android.os.MessageQueue.nativePollOnce(Native method)
  at android.os.Looper.loopOnce(Looper.java:161)`

	noManagedFramesMain = `"main" prio=5 tid=1 Native
  (no managed stack frames)`

	// Blocked on a monitor a worker holds while running app code.
	heldByAppWorker = `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"pool-1-thread-1" daemon prio=5 tid=21 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.foo.Cache.refresh(Cache.kt:88)
  - locked <0x0cd03f02> (a java.lang.Object)`

	// The same root cause reached from a different call site.
	heldByAppWorkerOtherCaller = `"main" prio=5 tid=1 Blocked
  at sh.foo.Settings.save(Settings.kt:64)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"pool-1-thread-1" daemon prio=5 tid=21 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.foo.Cache.refresh(Cache.kt:88)
  - locked <0x0cd03f02> (a java.lang.Object)`

	// The same call site, blocked by different app code.
	heldByOtherAppWorker = `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"pool-1-thread-1" daemon prio=5 tid=21 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.foo.Uploader.flush(Uploader.kt:17)
  - locked <0x0cd03f02> (a java.lang.Object)`

	// The stalled thread runs app code, the holder does not.
	heldByFrameworkThread = `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"Binder:1_2" prio=5 tid=21 Native
  at android.os.BinderProxy.transactNative(Native method)
  - locked <0x0cd03f02> (a java.lang.Object)`

	// Nothing in the chain runs app code.
	heldWithNoAppCodeAnywhere = `"main" prio=5 tid=1 Blocked
  at android.os.MessageQueue.nativePollOnce(Native method)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 21

"Binder:1_2" prio=5 tid=21 Native
  at android.os.BinderProxy.transactNative(Native method)
  - locked <0x0cd03f02> (a java.lang.Object)`

	// Two hops, with the app code at the root.
	twoHopChain = `"main" prio=5 tid=1 Blocked
  at android.os.Handler.dispatchMessage(Handler.java:110)
  - waiting to lock <0x0aaa0001> (a java.lang.Object) held by thread 21

"worker-a" daemon prio=5 tid=21 Blocked
  at android.database.sqlite.SQLiteConnection.nativeExecute(Native method)
  - waiting to lock <0x0bbb0002> (a java.lang.Object) held by thread 22

"worker-b" daemon prio=5 tid=22 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.foo.Importer.run(Importer.kt:41)
  - locked <0x0bbb0002> (a java.lang.Object)`

	// Two hops, with the app code halfway along and none at the root.
	appCodeMidChain = `"main" prio=5 tid=1 Blocked
  at android.os.Handler.dispatchMessage(Handler.java:110)
  - waiting to lock <0x0aaa0001> (a java.lang.Object) held by thread 21

"worker-a" daemon prio=5 tid=21 Blocked
  at sh.foo.Importer.run(Importer.kt:41)
  - waiting to lock <0x0bbb0002> (a java.lang.Object) held by thread 22

"Binder:1_2" prio=5 tid=22 Native
  at android.os.BinderProxy.transactNative(Native method)
  - locked <0x0bbb0002> (a java.lang.Object)`

	// A true deadlock: each thread wants the monitor the other holds.
	lockCycle = `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0aaa0001> (a java.lang.Object) held by thread 21

"worker" daemon prio=5 tid=21 Blocked
  at sh.foo.Cache.refresh(Cache.kt:88)
  - waiting to lock <0x0bbb0002> (a java.lang.Object) held by thread 1
  - locked <0x0aaa0001> (a java.lang.Object)`

	// The 256 KB cap drops trailing threads, so a holder can be named
	// by a dump that no longer contains it.
	holderTruncatedAway = `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 99`

	holderThreadZero = `"main" prio=5 tid=1 Blocked
  at sh.foo.Screen.render(Screen.kt:12)
  - waiting to lock <0x0cd03f02> (a java.lang.Object) held by thread 0`

	// Object.wait releases the monitor, so the thread holding it now is
	// not the one blocking us. ART names a holder on this line too,
	// which is why the chain discriminates on the lock state rather
	// than on the presence of a holder id.
	mainInObjectWait = `"main" prio=5 tid=1 Waiting
  at java.lang.Object.wait(Native method)
  - waiting on <0x0cd03f02> (a java.lang.Object) held by thread 21
  at sh.foo.Screen.await(Screen.kt:31)

"worker" daemon prio=5 tid=21 Sleeping
  at sh.foo.Cache.refresh(Cache.kt:88)
  - locked <0x0cd03f02> (a java.lang.Object)`

	// A stalled thread blocked by a sleeping holder, with a lock line
	// on each, used for the rendering tests.
	blockedByLocker = `"main" prio=5 tid=1 Blocked
  at sh.foo.Repo.load(Repo.kt:8)
  - waiting to lock <0x053dd6df> (a java.lang.Object) held by thread 46
DumpLatencyMs: 2.47

"APP: Locker" daemon prio=5 tid=46 Sleeping
  at java.lang.Thread.sleep(Native method)
  - sleeping on <0x07c5c2d7> (a java.lang.Object)
  native: #00 pc 0004df5c  /apex/libc.so (syscall+28)`
)

const lockerHeader = `"APP: Locker" daemon prio=5 tid=46 Sleeping`

// dumpANR builds an ANR the way ingest does, so a test reads what the
// dashboard would.
func dumpANR(subject, dump string) ANR {
	parsed := artdump.Parse(dump)
	parsed.Annotate()

	return ANR{
		Subject:       subject,
		ArtThreadDump: dump,
		ThreadDump:    parsed,
	}
}

func fingerprintOf(t *testing.T, anr ANR) string {
	t.Helper()
	if err := anr.ComputeFingerprint(); err != nil {
		t.Fatalf("Unexpected error computing fingerprint: %v", err)
	}
	return anr.Fingerprint
}

// hashOf computes a fingerprint the way both formulas finish, so a test
// asserts on the fingerprint input rather than on an opaque digest.
func hashOf(input string) string {
	hash := md5.Sum([]byte(input))
	return hex.EncodeToString(hash[:])
}

func viewOf(subject, dump string) EventANR {
	e := EventANR{ANR: dumpANR(subject, dump)}
	e.ComputeView()
	return e
}

func TestANRBlameChain(t *testing.T) {
	cases := []struct {
		name string
		dump string
		want []string
	}{
		{"Stops at the stalled thread when nothing blocks it", inAppStall, []string{"main"}},
		{"Follows a monitor to the thread holding it", heldByAppWorker, []string{"main", "pool-1-thread-1"}},
		{"Follows the chain through an intermediate thread", twoHopChain, []string{"main", "worker-a", "worker-b"}},
		{"Stops on a cycle", lockCycle, []string{"main", "worker"}},
		{"Stops when the holder is not in the dump", holderTruncatedAway, []string{"main"}},
		{"Ignores a holder id of zero", holderThreadZero, []string{"main"}},
		{"Does not follow Object.wait", mainInObjectWait, []string{"main"}},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var got []string
			for _, thread := range dumpANR(inputSubject, c.dump).ThreadDump.BlameThreads() {
				got = append(got, thread.Name)
			}
			if !reflect.DeepEqual(got, c.want) {
				t.Errorf("Expected chain %q, but got %q", c.want, got)
			}
		})
	}
}

// TestANRDumpFingerprint covers the whole grouping rule: which frame is
// selected, and what the key is built from.
func TestANRDumpFingerprint(t *testing.T) {
	t.Run("Groups on the thread holding the lock", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(inputSubject, heldByAppWorker))
		if want := hashOf("art#refresh:Cache.kt"); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Groups two call sites blocked on one root cause together", func(t *testing.T) {
		render := fingerprintOf(t, dumpANR(inputSubject, heldByAppWorker))
		save := fingerprintOf(t, dumpANR(inputSubject, heldByAppWorkerOtherCaller))
		if render != save {
			t.Errorf("Expected one fingerprint for one root cause, got %q and %q", render, save)
		}
	})

	t.Run("Separates two root causes blocked from one call site", func(t *testing.T) {
		cache := fingerprintOf(t, dumpANR(inputSubject, heldByAppWorker))
		uploader := fingerprintOf(t, dumpANR(inputSubject, heldByOtherAppWorker))
		if cache == uploader {
			t.Errorf("Expected different fingerprints for different root causes, both were %q", cache)
		}
	})

	t.Run("Resolves a two-hop chain to its root", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(inputSubject, twoHopChain))
		if want := hashOf("art#run:Importer.kt"); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Prefers the deepest app code in the chain", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(inputSubject, appCodeMidChain))
		if want := hashOf("art#run:Importer.kt"); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Groups a deadlock cycle on app code without hanging", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(inputSubject, lockCycle))
		if want := hashOf("art#refresh:Cache.kt"); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Does not blame the monitor holder for an Object.wait", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(inputSubject, mainInObjectWait))
		if want := hashOf("art#await:Screen.kt"); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Falls back to the stalled thread when the holder runs no app code", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(inputSubject, heldByFrameworkThread))
		if want := hashOf("art#render:Screen.kt"); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Groups on the stalled thread's first in-app frame when nothing blocks it", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(inputSubject, inAppStall))
		if want := hashOf("art#load:Repo.kt"); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Ignores the subject category when a frame is in-app", func(t *testing.T) {
		input := fingerprintOf(t, dumpANR(inputSubject, inAppStall))
		broadcast := fingerprintOf(t, dumpANR(broadcastSubject, inAppStall))
		if input != broadcast {
			t.Errorf("Expected one fingerprint across subject categories, got %q and %q", input, broadcast)
		}
	})

	t.Run("Groups on category and first managed frame when nothing is in-app", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(inputSubject, idleMain))
		if want := hashOf("art#Input dispatching timed out:nativePollOnce:Native method"); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Falls back to category and the stalled frame when nothing runs app code", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(inputSubject, heldWithNoAppCodeAnywhere))
		want := hashOf("art#Input dispatching timed out:nativePollOnce:Native method")
		if got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Separates different managed frames under one category", func(t *testing.T) {
		binder := `"main" prio=5 tid=1 Native
  at android.os.BinderProxy.transactNative(Native method)`
		polling := fingerprintOf(t, dumpANR(inputSubject, idleMain))
		blocked := fingerprintOf(t, dumpANR(inputSubject, binder))
		if polling == blocked {
			t.Errorf("Expected different fingerprints for different managed frames, both were %q", polling)
		}
	})

	t.Run("Separates different categories under one managed frame", func(t *testing.T) {
		input := fingerprintOf(t, dumpANR(inputSubject, idleMain))
		broadcast := fingerprintOf(t, dumpANR(broadcastSubject, idleMain))
		if input == broadcast {
			t.Errorf("Expected different fingerprints for different categories, both were %q", input)
		}
	})

	t.Run("Falls back to the frame alone for an unrecognised subject", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(unknownSubject, idleMain))
		if want := hashOf("art#nativePollOnce:Native method"); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Falls back to the category alone when there are no managed frames", func(t *testing.T) {
		got := fingerprintOf(t, dumpANR(inputSubject, noManagedFramesMain))
		if want := hashOf("art#Input dispatching timed out"); got != want {
			t.Errorf("Expected fingerprint %q, but got %q", want, got)
		}
	})

	t.Run("Produces no fingerprint when neither category nor frame is available", func(t *testing.T) {
		if got := fingerprintOf(t, dumpANR(unknownSubject, noManagedFramesMain)); got != "" {
			t.Errorf("Expected no fingerprint, but got %q", got)
		}
	})

	t.Run("Produces no fingerprint and no error for an anr with neither representation", func(t *testing.T) {
		anr := ANR{Subject: inputSubject}
		if err := anr.ComputeFingerprint(); err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if anr.Fingerprint != "" {
			t.Errorf("Expected no fingerprint, but got %q", anr.Fingerprint)
		}
	})

	t.Run("Ignores native frames", func(t *testing.T) {
		relocated := strings.Replace(inAppStall, "pc 0004df5c", "pc 00081a04", 1)
		if relocated == inAppStall {
			t.Fatal("fixture did not change, the test would assert nothing")
		}
		original := fingerprintOf(t, dumpANR(inputSubject, inAppStall))
		moved := fingerprintOf(t, dumpANR(inputSubject, relocated))
		if original != moved {
			t.Errorf("Expected one fingerprint across native frames, got %q and %q", original, moved)
		}
	})

	t.Run("Ignores frames below the grouping frame", func(t *testing.T) {
		deeper := inAppStall + "\n  at sh.foo.Other.call(Other.kt:31)"
		original := fingerprintOf(t, dumpANR(inputSubject, inAppStall))
		extended := fingerprintOf(t, dumpANR(inputSubject, deeper))
		if original != extended {
			t.Errorf("Expected one fingerprint across trailing frames, got %q and %q", original, extended)
		}
	})

	t.Run("Never collides with a legacy fingerprint over the same strings", func(t *testing.T) {
		legacy := ANR{
			Exceptions: ExceptionUnits{
				{Type: "art", Frames: Frames{{MethodName: "load", FileName: "Repo.kt"}}},
			},
		}
		dump := fingerprintOf(t, dumpANR(inputSubject, inAppStall))
		if got := fingerprintOf(t, legacy); got == dump {
			t.Errorf("Expected a dump fingerprint distinct from the legacy one, both were %q", got)
		}
	})

	t.Run("Prefers exceptions when an anr carries both representations", func(t *testing.T) {
		legacy := ANR{
			Exceptions: ExceptionUnits{
				{Type: "AppNotResponding", Frames: Frames{{MethodName: "blockerMethod", FileName: "MainActivity.java"}}},
			},
		}
		both := legacy
		both.Subject = inputSubject
		both.ArtThreadDump = inAppStall
		both.ThreadDump = artdump.Parse(inAppStall)

		if got, want := fingerprintOf(t, both), fingerprintOf(t, legacy); got != want {
			t.Errorf("Expected the exception fingerprint %q, but got %q", want, got)
		}
	})
}

func TestANRDumpAccessors(t *testing.T) {
	stalled := dumpANR(inputSubject, inAppStall)
	idle := dumpANR(unknownSubject, noManagedFramesMain)

	t.Run("GetType returns the subject category", func(t *testing.T) {
		if got, want := stalled.GetType(), "Input dispatching timed out"; got != want {
			t.Errorf("Expected type %q, but got %q", want, got)
		}
	})

	t.Run("GetType is empty for an unrecognised subject", func(t *testing.T) {
		if got := idle.GetType(); got != "" {
			t.Errorf("Expected no type, but got %q", got)
		}
	})

	t.Run("GetMessage returns the whole subject", func(t *testing.T) {
		if got, want := stalled.GetMessage(), inputSubject; got != want {
			t.Errorf("Expected message %q, but got %q", want, got)
		}
	})

	t.Run("Frame accessors report the grouping frame", func(t *testing.T) {
		if got, want := stalled.GetFileName(), "Repo.kt"; got != want {
			t.Errorf("Expected file name %q, but got %q", want, got)
		}
		if got, want := stalled.GetMethodName(), "load"; got != want {
			t.Errorf("Expected method name %q, but got %q", want, got)
		}
		if got, want := stalled.GetLineNumber(), int32(8); got != want {
			t.Errorf("Expected line number %d, but got %d", want, got)
		}
	})

	t.Run("Frame accessors report the thread holding the lock", func(t *testing.T) {
		blocked := dumpANR(inputSubject, heldByAppWorker)

		if got, want := blocked.GetFileName(), "Cache.kt"; got != want {
			t.Errorf("Expected file name %q, but got %q", want, got)
		}
		if got, want := blocked.GetMethodName(), "refresh"; got != want {
			t.Errorf("Expected method name %q, but got %q", want, got)
		}
		if got, want := blocked.GetLineNumber(), int32(88); got != want {
			t.Errorf("Expected line number %d, but got %d", want, got)
		}
	})

	t.Run("Groups on the first managed frame below the native ones", func(t *testing.T) {
		nativeFirst := `"main" prio=5 tid=1 Native
  native: #00 pc 0004df5c  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+28)
  native: #01 pc 000d1a90  /system/lib64/libandroid_runtime.so (???)
  at android.os.MessageQueue.nativePollOnce(Native method)`

		if got, want := dumpANR(inputSubject, nativeFirst).GetMethodName(), "nativePollOnce"; got != want {
			t.Errorf("Expected method name %q, but got %q", want, got)
		}
	})

	t.Run("A frame without a source line reports line zero", func(t *testing.T) {
		anr := dumpANR(inputSubject, idleMain)

		if got, want := anr.GetMethodName(), "nativePollOnce"; got != want {
			t.Fatalf("Expected the grouping frame %q, but got %q", want, got)
		}
		if got := anr.GetLineNumber(); got != 0 {
			t.Errorf("Expected line number 0, but got %d", got)
		}
	})

	t.Run("Frame accessors are empty without a managed frame", func(t *testing.T) {
		if got := idle.GetFileName(); got != "" {
			t.Errorf("Expected no file name, but got %q", got)
		}
		if got := idle.GetMethodName(); got != "" {
			t.Errorf("Expected no method name, but got %q", got)
		}
		if got := idle.GetLineNumber(); got != 0 {
			t.Errorf("Expected no line number, but got %d", got)
		}
	})

	t.Run("HasNoFrames reflects the blame chain", func(t *testing.T) {
		if stalled.HasNoFrames() {
			t.Error("Expected the stalled thread to have frames")
		}
		if !idle.HasNoFrames() {
			t.Error("Expected no frames when the chain has none")
		}
	})

	t.Run("Stacktrace renders the stalled thread when nothing blocks it", func(t *testing.T) {
		got := stalled.Stacktrace()
		for _, want := range []string{
			`"main" prio=5 tid=1 Blocked`,
			"  at sh.foo.Repo.load(Repo.kt:8)",
			"  native: #00 pc 0004df5c",
		} {
			if !strings.Contains(got, want) {
				t.Errorf("Expected the stacktrace to contain %q, got:\n%s", want, got)
			}
		}
	})

	t.Run("Stacktrace renders the blocking thread when there is one", func(t *testing.T) {
		got := dumpANR(inputSubject, heldByAppWorker).Stacktrace()
		if !strings.Contains(got, `"pool-1-thread-1" daemon prio=5 tid=21 Sleeping`) {
			t.Errorf("Expected the blocking thread's stack, got:\n%s", got)
		}
	})

	t.Run("Reads the exceptions when an anr carries both representations", func(t *testing.T) {
		both := ANR{
			Exceptions: ExceptionUnits{
				{
					Type:    "AppNotResponding",
					Message: "Application Not Responding",
					Frames:  Frames{{MethodName: "blockerMethod", FileName: "MainActivity.java", LineNum: 42}},
				},
			},
			Subject:       inputSubject,
			ArtThreadDump: inAppStall,
			ThreadDump:    artdump.Parse(inAppStall),
		}

		if got, want := both.GetType(), "AppNotResponding"; got != want {
			t.Errorf("Expected type %q, but got %q", want, got)
		}
		if got, want := both.GetMessage(), "Application Not Responding"; got != want {
			t.Errorf("Expected message %q, but got %q", want, got)
		}
		if got, want := both.GetFileName(), "MainActivity.java"; got != want {
			t.Errorf("Expected file name %q, but got %q", want, got)
		}
		if got, want := both.GetLineNumber(), int32(42); got != want {
			t.Errorf("Expected line number %d, but got %d", want, got)
		}
	})

	t.Run("Accessors do not panic on a dump without a main thread", func(t *testing.T) {
		anr := dumpANR(inputSubject, `"msr-io" daemon prio=5 tid=12 Waiting
  at sh.foo.Repo.load(Repo.kt:8)`)

		if got := anr.GetFileName(); got != "" {
			t.Errorf("Expected no file name, but got %q", got)
		}
		if got := anr.Stacktrace(); got != "" {
			t.Errorf("Expected no stacktrace, but got %q", got)
		}
		if !anr.HasNoFrames() {
			t.Error("Expected no frames without a main thread")
		}
	})
}

func TestANRWithoutADumpAnswersFromTheSubject(t *testing.T) {
	// The reproduction-steps query reads anr.subject without the dump,
	// so the accessors have to answer with what that row holds.
	anr := ANR{Subject: inputSubject}

	if got, want := anr.GetType(), "Input dispatching timed out"; got != want {
		t.Errorf("Expected type %q, but got %q", want, got)
	}
	if got, want := anr.GetMessage(), inputSubject; got != want {
		t.Errorf("Expected message %q, but got %q", want, got)
	}
	if got := anr.GetFileName(); got != "" {
		t.Errorf("Expected no file name, but got %q", got)
	}
	if got := anr.GetMethodName(); got != "" {
		t.Errorf("Expected no method name, but got %q", got)
	}
	if got := anr.GetLineNumber(); got != 0 {
		t.Errorf("Expected no line number, but got %d", got)
	}
	if !anr.HasNoFrames() {
		t.Error("Expected no frames")
	}
	if got := anr.Stacktrace(); got != "" {
		t.Errorf("Expected no stacktrace, but got %q", got)
	}
}

func TestANRGetDisplayTitle(t *testing.T) {
	cases := []struct {
		name    string
		subject string
		dump    string
		want    string
	}{
		{"Joins type and file name", inputSubject, inAppStall, "Input dispatching timed out@Repo.kt"},
		{"Omits the separator when there is no type", unknownSubject, inAppStall, "Repo.kt"},
		{"Omits the separator when there is no file name", inputSubject, noManagedFramesMain, "Input dispatching timed out"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := dumpANR(c.subject, c.dump).GetDisplayTitle(); got != c.want {
				t.Errorf("Expected display title %q, but got %q", c.want, got)
			}
		})
	}
}

func TestANRViewNamesTheBlamedThread(t *testing.T) {
	t.Run("Carries the subject", func(t *testing.T) {
		if got, want := viewOf(inputSubject, blockedByLocker).ANRView.Subject, inputSubject; got != want {
			t.Errorf("Expected subject %q, but got %q", want, got)
		}
	})

	t.Run("Names the thread the anr is blamed on", func(t *testing.T) {
		if got := viewOf(inputSubject, blockedByLocker).ANRView.BlockingThread; got != lockerHeader {
			t.Errorf("Expected blocking thread %q, but got %q", lockerHeader, got)
		}
	})

	t.Run("Names no blocking thread when nothing blocks the stalled one", func(t *testing.T) {
		if got := viewOf(inputSubject, inAppStall).ANRView.BlockingThread; got != "" {
			t.Errorf("Expected no blocking thread, but got %q", got)
		}
	})
}

func TestANRViewStacktraceIsTheBlamedThread(t *testing.T) {
	// The session timeline carries this same string, so both name the
	// thread the ANR is blamed on.
	want := strings.Join([]string{
		lockerHeader,
		"  at java.lang.Thread.sleep(Native method)",
		"  - sleeping on <0x07c5c2d7> (a java.lang.Object)",
		"  native: #00 pc 0004df5c  /apex/libc.so (syscall+28)",
	}, "\n")

	if got := viewOf(inputSubject, blockedByLocker).ANRView.Stacktrace; got != want {
		t.Errorf("Expected stacktrace:\n%s\ngot:\n%s", want, got)
	}
}

func TestANRViewThreadList(t *testing.T) {
	e := viewOf(inputSubject, blockedByLocker)

	t.Run("Leaves the blamed thread out, it is already the stacktrace", func(t *testing.T) {
		for _, thread := range e.Threads {
			if thread.Name == e.ANRView.BlockingThread {
				t.Error("the blamed thread is rendered twice")
			}
		}
	})

	t.Run("Puts the stalled thread first among the rest", func(t *testing.T) {
		if len(e.Threads) != 1 {
			t.Fatalf("Expected 1 thread beside the blamed one, but got %d", len(e.Threads))
		}
		if got, want := e.Threads[0].Name, `"main" prio=5 tid=1 Blocked`; got != want {
			t.Errorf("Expected thread name %q, but got %q", want, got)
		}
	})

	t.Run("Keeps a lock beneath the frame it annotates and names its holder", func(t *testing.T) {
		want := []string{
			"  at sh.foo.Repo.load(Repo.kt:8)",
			"  - waiting to lock <0x053dd6df> (a java.lang.Object) held by APP: Locker",
		}
		if got := e.Threads[0].Frames; !slices.Equal(got, want) {
			t.Errorf("Expected frames %q, but got %q", want, got)
		}
	})
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
	if legacy.ANRView.BlockingThread != "" {
		t.Errorf("Expected no blocking thread, but got %q", legacy.ANRView.BlockingThread)
	}
}
