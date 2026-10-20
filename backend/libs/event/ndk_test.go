package event

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func readNativeEvent(t *testing.T, path string) EventField {
	t.Helper()
	bytes, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var ev EventField
	if err := json.Unmarshal(bytes, &ev); err != nil {
		t.Fatal(err)
	}
	ev.AppID = uuid.New()
	return ev
}

func TestNativeExceptionValidate(t *testing.T) {
	for _, path := range []string{"./testdata/ndk_sigsegv_one.json", "./testdata/ndk_sigabrt_one.json", "./testdata/ndk_gwp_asan_one.json"} {
		ev := readNativeEvent(t, path)
		if err := ev.Validate(); err != nil {
			t.Errorf("%s: expected no validation error, got %v", path, err)
		}
	}
}

func TestNativeMemoryErrorValidateAcceptsMTE(t *testing.T) {
	ev := readNativeEvent(t, "./testdata/ndk_gwp_asan_one.json")
	ev.Exception.MemoryError.Tool = "mte"
	ev.Exception.MemoryError.Type = "unknown"
	if err := ev.Validate(); err != nil {
		t.Errorf("expected no validation error, got %v", err)
	}
}

func TestNativeExceptionValidateRejects(t *testing.T) {
	t.Run("non Android os", func(t *testing.T) {
		ev := readNativeEvent(t, "./testdata/ndk_sigsegv_one.json")
		ev.Attribute.OSName = "ios"
		if err := ev.Validate(); err == nil {
			t.Error("expected validation error")
		}
	})

	t.Run("no frames", func(t *testing.T) {
		ev := readNativeEvent(t, "./testdata/ndk_sigsegv_one.json")
		ev.Exception.Exceptions[0].Frames = Frames{}
		if err := ev.Validate(); err == nil {
			t.Error("expected validation error")
		}
	})

	t.Run("unknown memory error type", func(t *testing.T) {
		ev := readNativeEvent(t, "./testdata/ndk_gwp_asan_one.json")
		ev.Exception.MemoryError.Type = "stack_overflow"
		if err := ev.Validate(); err == nil {
			t.Error("expected validation error")
		}
	})

	t.Run("unknown memory error tool", func(t *testing.T) {
		ev := readNativeEvent(t, "./testdata/ndk_gwp_asan_one.json")
		ev.Exception.MemoryError.Tool = "hwasan"
		if err := ev.Validate(); err == nil {
			t.Error("expected validation error")
		}
	})

	t.Run("binary image without build id", func(t *testing.T) {
		ev := readNativeEvent(t, "./testdata/ndk_sigsegv_one.json")
		ev.Exception.BinaryImages[0].Uuid = ""
		if err := ev.Validate(); err == nil {
			t.Error("expected validation error")
		}
	})
}

func TestNativeExceptionNeedsSymbolication(t *testing.T) {
	ev := readNativeEvent(t, "./testdata/ndk_sigsegv_one.json")
	if !ev.NeedsSymbolication() {
		t.Error("expected native exception to need symbolication")
	}
}

func TestNativeExceptionTitle(t *testing.T) {
	segv := readNativeEvent(t, "./testdata/ndk_sigsegv_one.json").Exception
	if got := segv.GetDisplayTitle(); got != "SIGSEGV@libfrank_crash.so" {
		t.Errorf("got %q", got)
	}
	if got := segv.GetMethodName(); got != "" {
		t.Errorf("expected the unnamed crashing frame, got %q", got)
	}

	abrt := readNativeEvent(t, "./testdata/ndk_sigabrt_one.json").Exception
	if got := abrt.GetMethodName(); got != "Java_sh_frankenstein_android_NativeCrash_abortWithMessage" {
		t.Errorf("got %q", got)
	}

	for i := range abrt.Exceptions[0].Frames {
		abrt.Exceptions[0].Frames[i].InApp = false
	}
	if got := abrt.GetMethodName(); got != "art::Runtime::Abort(char const*)" {
		t.Errorf("expected the first frame that is not noise, got %q", got)
	}
}

func TestNativeExceptionStacktrace(t *testing.T) {
	for _, name := range []string{"ndk_sigsegv", "ndk_sigabrt", "ndk_gwp_asan"} {
		ev := readNativeEvent(t, "./testdata/"+name+"_one.json")
		expected, err := readStacktrace("./testdata/" + name + "_stacktrace_one.txt")
		if err != nil {
			t.Fatal(err)
		}
		if got := ev.Exception.Stacktrace(); got != expected {
			t.Errorf("%s: expected %q stacktrace, but got %q", name, expected, got)
		}
	}
}

func TestNativeMemoryErrorView(t *testing.T) {
	ev := readNativeEvent(t, "./testdata/ndk_gwp_asan_one.json")
	exception := EventException{Exception: *ev.Exception}
	exception.ComputeView()

	got := exception.ExceptionView.MemoryError
	if got == nil {
		t.Fatal("want a memory error view")
	}
	if got.Tool != "gwp_asan" || got.Type != "use_after_free" || got.Address != "0x7718e1afe0" || got.Size != 32 {
		t.Errorf("got tool %q, type %q, address %q, size %d", got.Tool, got.Type, got.Address, got.Size)
	}
	if want := "Use After Free, 0 bytes into a 32-byte allocation at 0x7718e1afe0"; exception.ExceptionView.Cause != want {
		t.Errorf("want cause %q, got %q", want, exception.ExceptionView.Cause)
	}

	wantDeallocation := []string{
		"#00 pc 0x0000000000047c64  libc.so (gwp_asan::AllocationMetadata::CallSiteInfo::RecordBacktrace(unsigned long (*)(unsigned long*, unsigned long)))",
		"#01 pc 0x0000000000048388  libc.so (gwp_asan::GuardedPoolAllocator::deallocate(void*))",
		"#02 pc 0x0000000000000b5c  libfrank_crash.so",
		"#03 pc 0x0000000000000b10  libfrank_crash.so (Java_sh_frankenstein_android_NativeCrash_useAfterFree)",
		"#04 pc 0x0000000000222244  libart.so (art_quick_generic_jni_trampoline)",
	}
	if got.Deallocation == nil || got.Deallocation.ThreadID != 20644 || strings.Join(got.Deallocation.Frames, "\n") != strings.Join(wantDeallocation, "\n") {
		t.Errorf("got deallocation %+v", got.Deallocation)
	}
	wantAllocation := []string{
		"#00 pc 0x0000000000047c64  libc.so (gwp_asan::AllocationMetadata::CallSiteInfo::RecordBacktrace(unsigned long (*)(unsigned long*, unsigned long)))",
		"#01 pc 0x0000000000048294  libc.so (gwp_asan::GuardedPoolAllocator::allocate(unsigned long, unsigned long))",
		"#02 pc 0x000000000003c298  libc.so (gwp_asan_malloc(unsigned long))",
		"#03 pc 0x000000000003ccc4  libc.so (malloc)",
		"#04 pc 0x0000000000000b50  libfrank_crash.so",
		"#05 pc 0x0000000000000b10  libfrank_crash.so (Java_sh_frankenstein_android_NativeCrash_useAfterFree)",
		"#06 pc 0x0000000000222244  libart.so (art_quick_generic_jni_trampoline)",
	}
	if got.Allocation == nil || got.Allocation.ThreadID != 20644 || strings.Join(got.Allocation.Frames, "\n") != strings.Join(wantAllocation, "\n") {
		t.Errorf("got allocation %+v", got.Allocation)
	}
}

func TestNativeExceptionMessage(t *testing.T) {
	abrt := readNativeEvent(t, "./testdata/ndk_sigabrt_one.json").Exception
	if got := abrt.GetMessage(); got != "Check failed: ptr != nullptr" {
		t.Errorf("got %q", got)
	}

	segv := readNativeEvent(t, "./testdata/ndk_sigsegv_one.json").Exception
	if got := segv.GetMessage(); got != "SEGV_MAPERR at 0x0" {
		t.Errorf("got %q", got)
	}

	uaf := readNativeEvent(t, "./testdata/ndk_gwp_asan_one.json").Exception
	if got := uaf.GetMessage(); got != "Use After Free" {
		t.Errorf("got %q", got)
	}
}

func TestNativeExceptionFingerprint(t *testing.T) {
	ev := readNativeEvent(t, "./testdata/ndk_sigsegv_one.json")
	if err := ev.Exception.ComputeFingerprint(); err != nil {
		t.Fatal(err)
	}
	first := ev.Exception.Fingerprint

	t.Run("stable when addresses change", func(t *testing.T) {
		moved := readNativeEvent(t, "./testdata/ndk_sigsegv_one.json")
		for i := range moved.Exception.Exceptions[0].Frames {
			frame := &moved.Exception.Exceptions[0].Frames[i]
			frame.InstructionAddr = "0x1" + strings.TrimPrefix(frame.InstructionAddr, "0x")
			frame.BinaryAddress = "0x1" + strings.TrimPrefix(frame.BinaryAddress, "0x")
		}
		if err := moved.Exception.ComputeFingerprint(); err != nil {
			t.Fatal(err)
		}
		if moved.Exception.Fingerprint != first {
			t.Error("expected the same fingerprint")
		}
	})

	t.Run("stable when a function's parameters change", func(t *testing.T) {
		abrt := readNativeEvent(t, "./testdata/ndk_sigabrt_one.json")
		if err := abrt.Exception.ComputeFingerprint(); err != nil {
			t.Fatal(err)
		}
		changed := readNativeEvent(t, "./testdata/ndk_sigabrt_one.json")
		frame := &changed.Exception.Exceptions[0].Frames[4]
		frame.MethodName = "Java_sh_frankenstein_android_NativeCrash_abortWithMessage(_JNIEnv*, _jobject*)"
		if err := changed.Exception.ComputeFingerprint(); err != nil {
			t.Fatal(err)
		}
		if changed.Exception.Fingerprint != abrt.Exception.Fingerprint {
			t.Error("expected the same fingerprint")
		}
	})

	t.Run("differs by signal", func(t *testing.T) {
		other := readNativeEvent(t, "./testdata/ndk_sigsegv_one.json")
		other.Exception.Exceptions[0].Type = "SIGBUS"
		if err := other.Exception.ComputeFingerprint(); err != nil {
			t.Fatal(err)
		}
		if other.Exception.Fingerprint == first {
			t.Error("expected a different fingerprint")
		}
	})

	t.Run("differs by memory error type", func(t *testing.T) {
		uaf := readNativeEvent(t, "./testdata/ndk_gwp_asan_one.json")
		if err := uaf.Exception.ComputeFingerprint(); err != nil {
			t.Fatal(err)
		}
		overflow := readNativeEvent(t, "./testdata/ndk_gwp_asan_one.json")
		overflow.Exception.MemoryError.Type = "buffer_overflow"
		if err := overflow.Exception.ComputeFingerprint(); err != nil {
			t.Fatal(err)
		}
		if overflow.Exception.Fingerprint == uaf.Exception.Fingerprint {
			t.Error("expected a different fingerprint")
		}
	})

	t.Run("same across memory error tools", func(t *testing.T) {
		gwpASan := readNativeEvent(t, "./testdata/ndk_gwp_asan_one.json")
		if err := gwpASan.Exception.ComputeFingerprint(); err != nil {
			t.Fatal(err)
		}
		mte := readNativeEvent(t, "./testdata/ndk_gwp_asan_one.json")
		mte.Exception.MemoryError.Tool = "mte"
		if err := mte.Exception.ComputeFingerprint(); err != nil {
			t.Fatal(err)
		}
		if mte.Exception.Fingerprint != gwpASan.Exception.Fingerprint {
			t.Error("expected the same fingerprint")
		}
	})
}

func TestNativeFrameIsNoise(t *testing.T) {
	tests := []struct {
		method string
		want   bool
	}{
		{"abort", true},
		{"__cxa_throw", true},
		{"std::__1::__terminate(void (*)())", true},
		{"abortTransaction", false},
		{"raiseError", false},
	}
	for _, test := range tests {
		t.Run(test.method, func(t *testing.T) {
			if got := (Frame{MethodName: test.method}).isNativeNoise(); got != test.want {
				t.Errorf("isNativeNoise() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestNativeFunctionName(t *testing.T) {
	cases := map[string]string{
		"crash_now":                                        "crash_now",
		"Foo::bar(int)":                                    "Foo::bar",
		"Foo::bar(int) const":                              "Foo::bar",
		"Foo::bar(int) const &":                            "Foo::bar",
		"Foo::operator()(int)":                             "Foo::operator()",
		"foo()::$_0::operator()(int) const":                "foo()::$_0::operator()",
		"(anonymous namespace)::load(char const*)":         "(anonymous namespace)::load",
		"std::function<void (int)>::operator()(int) const": "std::function<void (int)>::operator()",
	}
	for in, want := range cases {
		if got := nativeFunctionName(in); got != want {
			t.Errorf("nativeFunctionName(%q) = %q, want %q", in, got, want)
		}
	}
}
