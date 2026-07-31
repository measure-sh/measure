package event

import "testing"

func anrWithDump(subject, dump string) ANR {
	return ANR{
		Exceptions: ExceptionUnits{
			{
				Type:    "sh.measure.android.anr.AnrError",
				Message: "Application Not Responding for at least 5s",
				Frames: Frames{
					{
						ClassName:  "sh.frankenstein.android.NativeAndroidScreenKt",
						MethodName: "NativeAndroidScreen$lambda$16$0$2",
						FileName:   "NativeAndroidScreen.kt",
						LineNum:    221,
					},
				},
			},
		},
		Threads:    Threads{{Name: "main", Frames: Frames{}}},
		Subject:    subject,
		ThreadDump: dump,
	}
}

// TestANREnrichedDisplayFields pins the fields the errors list, the
// error detail view and the session timeline all read through these
// accessors. The frame stays the SDK capture, which is the main
// thread by construction; only the type and message come from the
// system.
func TestANREnrichedDisplayFields(t *testing.T) {
	subject := "Input dispatching timed out (7ff41e sh.frankenstein.android/.MainActivity is not responding. Waited 5000ms for MotionEvent)."
	anr := anrWithDump(subject, `"main" prio=5 tid=1 Blocked`)

	if got := anr.GetType(); got != ApplicationNotResponding {
		t.Errorf("type: got %q, want %q", got, ApplicationNotResponding)
	}
	if got := anr.GetMessage(); got != subject {
		t.Errorf("message: got %q, want %q", got, subject)
	}
	if got := anr.GetMethodName(); got != "NativeAndroidScreen$lambda$16$0$2" {
		t.Errorf("method name must stay the sdk captured frame, got %q", got)
	}
	if got := anr.GetFileName(); got != "NativeAndroidScreen.kt" {
		t.Errorf("file name must stay the sdk captured frame, got %q", got)
	}
	if got := anr.GetLineNumber(); got != 221 {
		t.Errorf("line number must stay the sdk captured frame, got %d", got)
	}
	if want := ApplicationNotResponding + "@NativeAndroidScreen.kt"; anr.GetDisplayTitle() != want {
		t.Errorf("display title: got %q, want %q", anr.GetDisplayTitle(), want)
	}
}

// TestANRWithoutDumpDisplayFields covers API < 30, older SDKs and an
// exit whose dump never arrived: every field keeps its old value.
func TestANRWithoutDumpDisplayFields(t *testing.T) {
	anr := anrWithDump("", "")

	if got := anr.GetType(); got != "sh.measure.android.anr.AnrError" {
		t.Errorf("type: got %q, want the sdk error class", got)
	}
	if got := anr.GetMessage(); got != "Application Not Responding for at least 5s" {
		t.Errorf("message: got %q, want the sdk message", got)
	}
}

// TestANRDumpWithoutSubject covers a dump that carried no Subject
// line: the type still reports the condition, the message falls back.
func TestANRDumpWithoutSubject(t *testing.T) {
	anr := anrWithDump("", `"main" prio=5 tid=1 Blocked`)

	if got := anr.GetType(); got != ApplicationNotResponding {
		t.Errorf("type: got %q, want %q", got, ApplicationNotResponding)
	}
	if got := anr.GetMessage(); got != "Application Not Responding for at least 5s" {
		t.Errorf("message: got %q, want the sdk message", got)
	}
}

// TestANRGetRelevantFrame covers the case that made ANR titles
// useless: a main thread parked in Thread.sleep, where the frame worth
// naming sits below the platform frames.
func TestANRGetRelevantFrame(t *testing.T) {
	anr := ANR{
		ThreadDump: `"main" prio=5 tid=1 Sleeping`,
		Exceptions: ExceptionUnits{
			{
				Frames: Frames{
					{ClassName: "java.lang.Thread", MethodName: "sleep", FileName: "Thread.java", LineNum: -2},
					{ClassName: "java.lang.Thread", MethodName: "sleep", FileName: "Thread.java", LineNum: 451},
					{ClassName: "sh.frankenstein.android.AnrService", MethodName: "onStartCommand", FileName: "AnrComponents.kt", LineNum: 35},
				},
			},
		},
	}
	anr.Exceptions.MarkInApp()

	if got := anr.GetMethodName(); got != "onStartCommand" {
		t.Errorf("method name: got %q, want onStartCommand", got)
	}
	if got := anr.GetFileName(); got != "AnrComponents.kt" {
		t.Errorf("file name: got %q, want AnrComponents.kt", got)
	}
	if got := anr.GetLineNumber(); got != 35 {
		t.Errorf("line number: got %d, want 35", got)
	}
}

// TestANRGetRelevantFrameAllPlatform covers a main thread idle in the
// looper, where no app frame exists to name and the first frame is
// the only honest answer.
func TestANRGetRelevantFrameAllPlatform(t *testing.T) {
	anr := ANR{
		ThreadDump: `"main" prio=5 tid=1 Native`,
		Exceptions: ExceptionUnits{
			{
				Frames: Frames{
					{ClassName: "android.os.MessageQueue", MethodName: "nativePollOnce", FileName: "MessageQueue.java", LineNum: -2},
					{ClassName: "android.os.Looper", MethodName: "loop", FileName: "Looper.java", LineNum: 338},
				},
			},
		},
	}
	anr.Exceptions.MarkInApp()

	if got := anr.GetMethodName(); got != "nativePollOnce" {
		t.Errorf("method name: got %q, want nativePollOnce", got)
	}
}

// TestANRComputeFingerprintWithoutDumpIsUnchanged pins that an ANR
// with no system dump still keys on its first frame. Two stalls in
// different app code share a group because both park the main thread
// in Thread.sleep, which is poor grouping but is exactly how these
// events grouped before app frames were marked. Changing it would
// strand every group already formed from them.
func TestANRComputeFingerprintWithoutDumpIsUnchanged(t *testing.T) {
	service := anrStuckAt("", "com.example.SyncService", "onStartCommand", "SyncService.kt")
	uploader := anrStuckAt("", "com.example.Uploader", "flush", "Uploader.kt")

	if service.Fingerprint != uploader.Fingerprint {
		t.Error("an anr with no dump must keep keying on its first frame")
	}
}

// TestANRComputeFingerprintWithDumpUsesRelevantFrame covers the events
// the dump introduced, which have no groups to preserve and so are
// keyed on the call that actually blocked.
func TestANRComputeFingerprintWithDumpUsesRelevantFrame(t *testing.T) {
	dump := `"main" prio=5 tid=1 Sleeping`
	service := anrStuckAt(dump, "com.example.SyncService", "onStartCommand", "SyncService.kt")
	uploader := anrStuckAt(dump, "com.example.Uploader", "flush", "Uploader.kt")

	if service.Fingerprint == uploader.Fingerprint {
		t.Error("stalls in different app code must not share a group")
	}
	same := anrStuckAt(dump, "com.example.SyncService", "onStartCommand", "SyncService.kt")
	if same.Fingerprint != service.Fingerprint {
		t.Errorf("the same stall must group: got %q, want %q", same.Fingerprint, service.Fingerprint)
	}
}

// anrStuckAt builds an ANR parked in Thread.sleep with the given app
// frame beneath it, and fingerprints it.
func anrStuckAt(threadDump, className, methodName, fileName string) *ANR {
	anr := &ANR{
		ThreadDump: threadDump,
		Exceptions: ExceptionUnits{{
			Type: "sh.measure.android.anr.AnrError",
			Frames: Frames{
				{ClassName: "java.lang.Thread", MethodName: "sleep", FileName: "Thread.java", LineNum: -2},
				{ClassName: className, MethodName: methodName, FileName: fileName, LineNum: 35},
			},
		}},
	}
	anr.Exceptions.MarkInApp()
	if err := anr.ComputeFingerprint(); err != nil {
		panic(err)
	}
	return anr
}

// TestANRWithoutDumpKeepsParkedFrame pins the display fields of an ANR
// with no system dump. The main thread is parked in Thread.sleep with
// the app frame that stalled it just below, and naming that app frame
// would rewrite the title of every group already formed from these
// events.
func TestANRWithoutDumpKeepsParkedFrame(t *testing.T) {
	anr := anrStuckAt("", "com.example.SyncService", "onStartCommand", "SyncService.kt")

	if got := anr.GetMethodName(); got != "sleep" {
		t.Errorf("method name: got %q, want sleep", got)
	}
	if got := anr.GetFileName(); got != "Thread.java" {
		t.Errorf("file name: got %q, want Thread.java", got)
	}
	if got := anr.GetDisplayTitle(); got != "sh.measure.android.anr.AnrError@Thread.java" {
		t.Errorf("display title: got %q", got)
	}
}
