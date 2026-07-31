package symbolicator

import (
	"testing"

	"backend/libs/event"
)

const anrSubjectInput = "Input dispatching timed out (60d98dc sh.frankenstein.android/.MainActivity is not responding)."

// anrStuckAt builds an ANR whose capture blames the given frames, which
// is how the blocked thread is identified without reading names or
// positions out of the dump.
func anrStuckAt(subject, dump string, frames event.Frames) *event.ANR {
	anr := &event.ANR{
		Exceptions: event.ExceptionUnits{{
			Type:    "sh.measure.android.anr.AnrError",
			Message: "Application Not Responding for at least 5s",
			Frames:  frames,
		}},
		Subject:    subject,
		ThreadDump: dump,
	}
	anr.Exceptions.MarkInApp()
	return anr
}

func anrFrames(frames ...event.Frame) event.Frames {
	return append(event.Frames{
		{ClassName: "java.lang.Thread", MethodName: "sleep", FileName: "Thread.java", LineNum: -2},
	}, frames...)
}

func appFrame(className, methodName, fileName string, lineNum int) event.Frame {
	return event.Frame{ClassName: className, MethodName: methodName, FileName: fileName, LineNum: lineNum}
}

func fingerprintOf(t *testing.T, anr *event.ANR) string {
	t.Helper()
	fingerprint, ok := ANRDumpFingerprint(anr)
	if !ok {
		t.Fatalf("no fingerprint for subject %q", anr.Subject)
	}
	return fingerprint
}

func TestAnrCategory(t *testing.T) {
	cases := []struct {
		subject string
		want    string
	}{
		{"", ""},
		{"Input dispatching timed out (com.example/.MainActivity is not responding. Waited 5002ms for MotionEvent)", "input_dispatch"},
		{"No focused window", "input_dispatch"},
		{"Broadcast of Intent { act=android.intent.action.SCREEN_ON cmp=com.example/.SyncServiceReceiver }", "broadcast"},
		{"executing service sh.frankenstein.android/.AnrService, waited 20004ms", "service"},
		{"ContentProvider not responding", "content_provider"},
		{"content provider not responding", "content_provider"},
		{"No response to onStartJob", "job"},
		{"No response to onStopJob", "job"},
		{"something ART has not said before", "unknown"},
	}
	for _, c := range cases {
		if got := anrCategory(c.subject); got != c.want {
			t.Errorf("anrCategory(%q): got %q, want %q", c.subject, got, c.want)
		}
	}
}

// TestANRDumpFingerprintDeadlock covers the shape the fingerprint is
// built for: a blocked main thread, the lock it contends, and the
// holder that never releases it.
func TestANRDumpFingerprintDeadlock(t *testing.T) {
	dump := `"main" prio=5 tid=1 Blocked
  at com.example.Locker.block(Locker.kt:8)
  - waiting to lock <0x0e5c06d6> (a com.example.LockHolder) held by thread 48
  at android.os.Handler.handleCallback(Handler.java:1089)

"APP: Locker" prio=5 tid=48 Sleeping
  at java.lang.Thread.sleep(Native method)
  at com.example.Locker.hold(Locker.kt:29)`

	frames := event.Frames{appFrame("com.example.Locker", "block", "Locker.kt", 8)}
	want := fingerprintOf(t, anrStuckAt(anrSubjectInput, dump, frames))

	if got := fingerprintOf(t, anrStuckAt(anrSubjectInput, dump, frames)); got != want {
		t.Errorf("the same anr must produce the same fingerprint: got %q and %q", got, want)
	}

	// Line numbers must not fragment a group.
	moved := `"main" prio=5 tid=1 Blocked
  at com.example.Locker.block(Locker.kt:20)
  - waiting to lock <0x0e5c06d6> (a com.example.LockHolder) held by thread 48

"APP: Locker" prio=5 tid=48 Sleeping
  at java.lang.Thread.sleep(Native method)
  at com.example.Locker.hold(Locker.kt:35)`
	if got := fingerprintOf(t, anrStuckAt(anrSubjectInput, moved, frames)); got != want {
		t.Errorf("line numbers must not change the fingerprint: got %q, want %q", got, want)
	}

	// A different holder is a different defect.
	otherHolder := `"main" prio=5 tid=1 Blocked
  at com.example.Locker.block(Locker.kt:8)
  - waiting to lock <0x0e5c06d6> (a com.example.LockHolder) held by thread 48

"APP: Other" prio=5 tid=48 Runnable
  at com.example.Downloader.fetch(Downloader.kt:3)`
	if got := fingerprintOf(t, anrStuckAt(anrSubjectInput, otherHolder, frames)); got == want {
		t.Error("a different root blocking frame must change the fingerprint")
	}
}

// TestANRDumpFingerprintRootBlockingSkipsPlatformFrames pins the fix for
// a lock holder parked in Thread.sleep. Blaming the literal top frame
// gave every such ANR the same java.lang.Thread.sleep component, so
// deadlocks held by unrelated code collapsed onto it.
func TestANRDumpFingerprintRootBlockingSkipsPlatformFrames(t *testing.T) {
	heldBy := func(holderFrame string) string {
		return `"main" prio=5 tid=1 Blocked
  at com.example.Locker.block(Locker.kt:8)
  - waiting to lock <0x0e5c06d6> (a com.example.LockHolder) held by thread 48

"APP: Holder" prio=5 tid=48 Sleeping
  at java.lang.Thread.sleep(Native method)
  at java.lang.Thread.sleep(Thread.java:451)
  at ` + holderFrame
	}

	frames := event.Frames{appFrame("com.example.Locker", "block", "Locker.kt", 8)}
	fingerprintFor := func(holderFrame string) string {
		return fingerprintOf(t, anrStuckAt(anrSubjectInput, heldBy(holderFrame), frames))
	}

	uploader := fingerprintFor("com.example.Uploader.flush(Uploader.kt:12)")
	if database := fingerprintFor("com.example.Database.write(Database.kt:44)"); database == uploader {
		t.Error("holders blocking in different app code must not share a fingerprint")
	}
	if sameCall := fingerprintFor("com.example.Uploader.flush(Uploader.kt:99)"); sameCall != uploader {
		t.Errorf("the same holding call must group regardless of line: got %q, want %q", sameCall, uploader)
	}
}

// TestANRDumpFingerprintCategoryDoesNotSplitOneStall pins the
// fragmentation this formula used to cause. One blocked main thread
// trips several system deadlines in turn, a service start, a queued job
// and the next tap, each reporting a different subject. All of them
// must group together, because the app was stuck in the same call.
func TestANRDumpFingerprintCategoryDoesNotSplitOneStall(t *testing.T) {
	dump := `"main" prio=5 tid=1 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.frankenstein.android.AnrService.onStartCommand(AnrComponents.kt:35)`

	frames := anrFrames(appFrame("sh.frankenstein.android.AnrService", "onStartCommand", "AnrComponents.kt", 35))
	fingerprintFor := func(subject string) string {
		return fingerprintOf(t, anrStuckAt(subject, dump, frames))
	}

	service := fingerprintFor("executing service sh.frankenstein.android/.AnrService, waited 20004ms")
	job := fingerprintFor("No response to onStartJob")
	input := fingerprintFor(anrSubjectInput)

	if service != job || job != input {
		t.Errorf("one stall must be one group, got service=%q job=%q input=%q", service, job, input)
	}
}

// TestANRDumpFingerprintCategorySplitsWhenNoAppFrame covers a main
// thread idle in the looper. With no app frame to blame, the expired
// deadline is the only signal left, so it has to keep the groups apart
// rather than collapsing every unattributable ANR into one.
func TestANRDumpFingerprintCategorySplitsWhenNoAppFrame(t *testing.T) {
	dump := `"main" prio=5 tid=1 Native
  at android.os.MessageQueue.nativePollOnce(Native method)
  at android.os.Looper.loop(Looper.java:338)`

	frames := event.Frames{
		appFrame("android.os.MessageQueue", "nativePollOnce", "MessageQueue.java", -2),
		appFrame("android.os.Looper", "loop", "Looper.java", 338),
	}
	fingerprintFor := func(subject string) string {
		return fingerprintOf(t, anrStuckAt(subject, dump, frames))
	}

	broadcast := fingerprintFor("Broadcast of Intent { act=android.intent.action.SCREEN_ON }")
	if input := fingerprintFor(anrSubjectInput); broadcast == input {
		t.Error("with no app frame to blame, the expired deadline must still separate groups")
	}
}

// TestANRDumpFingerprintDifferentStallsStaySeparate guards the collapse
// above from going too far: two different app calls are two defects even
// when the same deadline expires.
func TestANRDumpFingerprintDifferentStallsStaySeparate(t *testing.T) {
	const subject = "No response to onStartJob"

	service := fingerprintOf(t, anrStuckAt(subject, `"main" prio=5 tid=1 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.frankenstein.android.AnrService.onStartCommand(AnrComponents.kt:35)`,
		anrFrames(appFrame("sh.frankenstein.android.AnrService", "onStartCommand", "AnrComponents.kt", 35))))

	job := fingerprintOf(t, anrStuckAt(subject, `"main" prio=5 tid=1 Sleeping
  at java.lang.Thread.sleep(Native method)
  at sh.frankenstein.android.AnrJobService.onStartJob(AnrComponents.kt:49)`,
		anrFrames(appFrame("sh.frankenstein.android.AnrJobService", "onStartJob", "AnrComponents.kt", 49))))

	if service == job {
		t.Error("different app calls must stay in different groups")
	}
}

func TestANRDumpFingerprintNotComputable(t *testing.T) {
	frames := event.Frames{appFrame("com.example.Locker", "block", "Locker.kt", 8)}
	dump := `"main" prio=5 tid=1 Blocked
  at com.example.Locker.block(Locker.kt:8)`

	if _, ok := ANRDumpFingerprint(nil); ok {
		t.Error("a nil anr must not produce a fingerprint")
	}
	if _, ok := ANRDumpFingerprint(anrStuckAt(anrSubjectInput, "", frames)); ok {
		t.Error("an anr with no thread dump must fall back to the sdk capture fingerprint")
	}
	if _, ok := ANRDumpFingerprint(anrStuckAt(anrSubjectInput, dump, event.Frames{})); ok {
		t.Error("a capture with no frames must fall back to the sdk capture fingerprint")
	}
}

// TestAnrFrameKeyBlanksMissingSourceFiles keeps the capture and the
// dump renderings of one frame equal. The dump writes a placeholder
// where the symbolicated file name was empty, and a mismatch would
// silently cost the lock and holder components.
func TestAnrFrameKeyBlanksMissingSourceFiles(t *testing.T) {
	want := "com.example.Locker.block()"
	for _, fileName := range []string{"", "Native method", "Unknown Source", "unknown source"} {
		if got := anrFrameKey("com.example.Locker.block", fileName); got != want {
			t.Errorf("anrFrameKey(_, %q): got %q, want %q", fileName, got, want)
		}
	}
}
