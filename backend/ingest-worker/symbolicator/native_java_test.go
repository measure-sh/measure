package symbolicator

import (
	"testing"

	"backend/libs/event"
)

func nativeFrame(binary, method string) event.Frame {
	return event.Frame{
		MethodName: method,
		FrameiOS:   &event.FrameiOS{BinaryName: binary},
	}
}

func TestIsNativeJavaFrame(t *testing.T) {
	cases := []struct {
		frame event.Frame
		want  bool
	}{
		{nativeFrame("base.vdex", "b1.h0.a"), true},
		{nativeFrame("memfd:jit-cache (deleted)", "androidx.compose.ui.input.pointer.Node.dispatchMainEventPass"), true},
		{nativeFrame("libart.so", "art::Runtime::Abort(char const*)"), false},
		{nativeFrame("libfrank_crash.so", "Java_sh_frankenstein_android_NativeCrash_segfault"), false},
		{nativeFrame("base.vdex", ""), false},
	}

	for _, tc := range cases {
		if got := isNativeJavaFrame(tc.frame); got != tc.want {
			t.Errorf("%+v: want %v, got %v", tc.frame.MethodName, tc.want, got)
		}
	}
}

func TestNativeJavaFramesRoundTrip(t *testing.T) {
	events := []event.EventField{{
		Type: event.TypeException,
		Exception: &event.Exception{
			Framework: event.FrameworkNDK,
			Exceptions: event.ExceptionUnits{{
				Frames: event.Frames{
					nativeFrame("libc.so", "abort"),
					nativeFrame("base.vdex", "b1.h0.a"),
					nativeFrame("libart.so", "nterp_helper"),
				},
			}},
		},
	}}

	js := jvmSymbolicator{}
	js.ensureRequestInitialized()
	js.parseNativeJavaFrames(events[0].Exception)

	sent := js.request.Stacktraces[0].Frames
	if len(sent) != 1 || sent[0].Module != "b1.h0" || sent[0].Function != "a" {
		t.Fatalf("unexpected request frames %+v", sent)
	}

	js.response = &responseJVM{Stacktraces: []stacktraceJVM{{Frames: []frameJVM{{
		Module:   "sh.frankenstein.android.NativeAndroidScreenKt",
		Function: "NativeAndroidScreen",
		Filename: "NativeAndroidScreen.kt",
		LineNo:   42,
	}}}}}
	js.rewriteNativeJavaFrames()

	frames := events[0].Exception.Exceptions[0].Frames
	if frames[1].MethodName != "sh.frankenstein.android.NativeAndroidScreenKt.NativeAndroidScreen" || frames[1].LineNum != 42 {
		t.Errorf("expected the Java frame to be deobfuscated, got %+v", frames[1])
	}
	if frames[0].MethodName != "abort" || frames[2].MethodName != "nterp_helper" {
		t.Error("expected native frames to stay unchanged")
	}
}

func TestNativeJavaFramesInGWPASanReport(t *testing.T) {
	exception := &event.Exception{
		Framework: event.FrameworkNDK,
		Exceptions: event.ExceptionUnits{{
			Frames: event.Frames{nativeFrame("libc.so", "abort")},
		}},
		GWPASanReport: &event.GWPASanReport{
			Type: "use_after_free",
			Allocation: &event.GWPASanReportStack{
				Frames: event.Frames{
					nativeFrame("libc.so", "malloc"),
					nativeFrame("base.vdex", "b1.h0.a"),
				},
			},
		},
	}

	js := jvmSymbolicator{}
	js.ensureRequestInitialized()
	js.parseNativeJavaFrames(exception)

	js.response = &responseJVM{Stacktraces: []stacktraceJVM{{Frames: []frameJVM{{
		Module:   "sh.frankenstein.android.NativeAndroidScreenKt",
		Function: "NativeAndroidScreen",
		Filename: "NativeAndroidScreen.kt",
		LineNo:   42,
	}}}}}
	js.rewriteNativeJavaFrames()

	frame := exception.GWPASanReport.Allocation.Frames[1]
	if frame.MethodName != "sh.frankenstein.android.NativeAndroidScreenKt.NativeAndroidScreen" || frame.LineNum != 42 {
		t.Errorf("expected the allocation stack's Java frame to be deobfuscated, got %+v", frame)
	}
}
