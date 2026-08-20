package event

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"backend/libs/artdump"

	"github.com/google/uuid"
)

func readException(path string) (exception Exception, err error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return
	}
	_ = json.Unmarshal(bytes, &exception)
	return
}

func readANR(path string) (anr ANR, err error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return
	}
	_ = json.Unmarshal(bytes, &anr)
	return
}

func readStacktrace(path string) (stacktrace string, err error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return
	}
	stacktrace = string(bytes)
	return
}

func TestExceptionStacktraceOne(t *testing.T) {
	exception, err := readException("./testdata/exception_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./testdata/exception_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected %q stacktrace, but got %q", expected, got)
	}
}

func TestNestedExceptionStacktraceOne(t *testing.T) {
	exception, err := readException("./testdata/nested_exception_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./testdata/nested_exception_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected %q stacktrace, but got %q", expected, got)
	}
}

func TestANRStacktraceOne(t *testing.T) {
	anr, err := readANR("./testdata/anr_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./testdata/anr_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := anr.Stacktrace()

	if expected != got {
		t.Errorf("Expected %q stacktrace, but got %q", expected, got)
	}
}

func TestObfuscatedDartNestedExceptionStacktraceOne(t *testing.T) {
	exception, err := readException("./testdata/dart_nested_exception_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./testdata/dart_nested_exception_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected %q stacktrace, but got %q", expected, got)
	}
}

func TestObfuscatedDartExceptionStacktraceOne(t *testing.T) {
	exception, err := readException("./testdata/dart_exception_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./testdata/dart_exception_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected %q stacktrace, but got %q", expected, got)
	}
}

func TestAppleExceptionStacktraceOne(t *testing.T) {
	exception, err := readException("./testdata/apple_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./testdata/apple_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected:\n%q\nGot:\n%q", expected, got)
	}
}

func TestAppleExceptionStacktraceTwo(t *testing.T) {
	exception, err := readException("./testdata/apple_two.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./testdata/apple_stacktrace_two.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected:\n%q\nGot:\n%q", expected, got)
	}
}

func TestJSExceptionStacktraceOne(t *testing.T) {
	exception, err := readException("./testdata/js_exception_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./testdata/js_exception_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected:\n%q\nGot:\n%q", expected, got)
	}
}

func TestHasError(t *testing.T) {
	// Empty exception
	{
		e := Exception{}
		expected := false
		got := e.HasError()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// Error has non-empty string code
	{
		e := Exception{
			Error: &Error{
				Code: "ENOFILE",
			},
		}
		expected := true
		got := e.HasError()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
	{
		e := Exception{
			Code: "ENOFILE",
		}
		expected := true
		got := e.HasError()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// Error has non-zero numeric code
	{
		e := Exception{
			Error: &Error{
				NumCode: 47,
			},
		}
		expected := true
		got := e.HasError()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
	{
		numCode := int32(47)
		e := Exception{
			NumCode: &numCode,
		}
		expected := true
		got := e.HasError()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// NumCode sent as zero is still present, not absent
	{
		numCode := int32(0)
		e := Exception{
			NumCode: &numCode,
		}
		expected := true
		got := e.HasError()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}

	// Error has some meta items
	{
		e := Exception{
			Error: &Error{
				Meta: map[string]any{
					"foo": "bar",
				},
			},
		}
		expected := true
		got := e.HasError()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
	{
		e := Exception{
			Meta: map[string]any{
				"foo": "bar",
			},
		}
		expected := true
		got := e.HasError()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	}
}

func TestGetType(t *testing.T) {
	t.Run("Android unhandled exception's type can be derived", func(t *testing.T) {
		exception := Exception{
			Handled: false,
			Exceptions: ExceptionUnits{
				{
					Type:    "java.lang.RuntimeException",
					Message: "java.lang.reflect.InvocationTargetException",
					Frames: Frames{
						{
							LineNum:    558,
							FileName:   "RuntimeInit.java",
							ClassName:  "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
							MethodName: "run",
						},
						{
							ClassName:  "com.android.internal.os.ZygoteInit",
							MethodName: "main",
							FileName:   "ZygoteInit.java",
							LineNum:    936,
						},
					},
				},
			},
			Threads: Threads{
				{
					Name: "ConnectivityThread",
					Frames: Frames{
						{
							ClassName:  "android.os.MessageQueue",
							MethodName: "nativePollOnce",
							FileName:   "MessageQueue.java",
							LineNum:    -2,
						},
						{
							ClassName:  "android.os.MessageQueue",
							MethodName: "next",
							FileName:   "MessageQueue.java",
							LineNum:    335,
						},
					},
				},
			},
			Foreground: true,
		}

		expected := "java.lang.RuntimeException"
		got := exception.GetType()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	})

	t.Run("Apple unhandled exception's type should be its signal", func(t *testing.T) {
		exception := Exception{
			Handled: false,
			Exceptions: ExceptionUnits{
				{
					ExceptionUnitiOS: &ExceptionUnitiOS{
						Signal:         "SIGABRT",
						ThreadName:     "Thread 0 Crashed",
						ThreadSequence: 0,
						OSBuildNumber:  "24D70",
					},
					Frames: Frames{
						{
							FrameiOS: &FrameiOS{
								BinaryName:    "libsystem_kernel.dylib",
								BinaryAddress: "100fcc000",
								Offset:        37128,
								FrameIndex:    0,
								SymbolAddress: "0000000100fd5108",
							},
							InApp: false,
						},
						{
							FrameiOS: &FrameiOS{
								BinaryName:    "libsystem_c.dylib",
								BinaryAddress: "1800fd000",
								Offset:        472300,
								FrameIndex:    1,
								SymbolAddress: "00000001801704ec",
							},
							InApp: false,
						},
					},
				},
			},
			Threads: Threads{
				{
					Name: "Thread 1",
					ThreadiOS: &ThreadiOS{
						Sequence: 1,
					},
					Frames: Frames{
						{
							FrameiOS: &FrameiOS{
								BinaryName:    "libsystem_kernel.dylib",
								BinaryAddress: "100fcc000",
								Offset:        11884,
								FrameIndex:    0,
								SymbolAddress: "0000000100fcee6c",
							},
							InApp: false,
						},
						{
							FrameiOS: &FrameiOS{
								BinaryName:    "libsystem_pthread.dylib",
								BinaryAddress: "100fcc000",
								Offset:        11884,
								FrameIndex:    1,
								SymbolAddress: "0000000100fcee6c",
							},
							InApp: false,
						},
					},
				},
			},
		}

		expected := "SIGABRT"
		got := exception.GetType()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	})

	t.Run("Apple handled exception with error's type might be its error's code", func(t *testing.T) {
		exception := Exception{
			// Handled should be true, but "type" computation
			// does not depend on this field
			Handled: true,
			Error: &Error{
				Code: "ENOFILE",
			},
		}

		expected := "ENOFILE"
		got := exception.GetType()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	})

	t.Run("Apple handled exception with error's type might be unknown", func(t *testing.T) {
		exception := Exception{
			// Handled should be true, but "type" computation
			// does not depend on this field
			Handled: true,
			Error: &Error{
				NumCode: 42,
			},
		}

		expected := "unknown type"
		got := exception.GetType()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	})
}

func TestGetMessage(t *testing.T) {
	t.Run("Android unhandled exception's message can be derived", func(t *testing.T) {
		exception := Exception{
			Handled: false,
			Exceptions: ExceptionUnits{
				{
					Type:    "java.lang.RuntimeException",
					Message: "java.lang.reflect.InvocationTargetException",
					Frames: Frames{
						{
							LineNum:    558,
							FileName:   "RuntimeInit.java",
							ClassName:  "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
							MethodName: "run",
						},
						{
							ClassName:  "com.android.internal.os.ZygoteInit",
							MethodName: "main",
							FileName:   "ZygoteInit.java",
							LineNum:    936,
						},
					},
				},
			},
			Threads: Threads{
				{
					Name: "ConnectivityThread",
					Frames: Frames{
						{
							ClassName:  "android.os.MessageQueue",
							MethodName: "nativePollOnce",
							FileName:   "MessageQueue.java",
							LineNum:    -2,
						},
						{
							ClassName:  "android.os.MessageQueue",
							MethodName: "next",
							FileName:   "MessageQueue.java",
							LineNum:    335,
						},
					},
				},
			},
			Foreground: true,
		}

		expected := "java.lang.reflect.InvocationTargetException"
		got := exception.GetMessage()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	})

	t.Run("Apple exception's message is always empty", func(t *testing.T) {
		exception := Exception{
			Handled: false,
			Exceptions: ExceptionUnits{
				{
					ExceptionUnitiOS: &ExceptionUnitiOS{
						Signal:         "",
						ThreadName:     "",
						ThreadSequence: 0,
						OSBuildNumber:  "",
					},
					Frames: Frames{
						{
							FrameiOS: &FrameiOS{
								BinaryName:    "libsystem_kernel.dylib",
								BinaryAddress: "100fcc000",
								Offset:        37128,
								FrameIndex:    0,
								SymbolAddress: "0000000100fd5108",
							},
							InApp: false,
						},
						{
							FrameiOS: &FrameiOS{
								BinaryName:    "libsystem_c.dylib",
								BinaryAddress: "1800fd000",
								Offset:        472300,
								FrameIndex:    1,
								SymbolAddress: "00000001801704ec",
							},
							InApp: false,
						},
					},
				},
			},
			Threads: Threads{
				{
					Name: "Thread 1",
					ThreadiOS: &ThreadiOS{
						Sequence: 1,
					},
					Frames: Frames{
						{
							FrameiOS: &FrameiOS{
								BinaryName:    "libsystem_kernel.dylib",
								BinaryAddress: "100fcc000",
								Offset:        11884,
								FrameIndex:    0,
								SymbolAddress: "0000000100fcee6c",
							},
							InApp: false,
						},
						{
							FrameiOS: &FrameiOS{
								BinaryName:    "libsystem_pthread.dylib",
								BinaryAddress: "100fcc000",
								Offset:        11884,
								FrameIndex:    1,
								SymbolAddress: "0000000100fcee6c",
							},
							InApp: false,
						},
					},
				},
			},
		}

		expected := ""
		got := exception.GetMessage()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	})
}

func TestGetFramework(t *testing.T) {
	t.Run("Provides framework if present", func(t *testing.T) {
		frameworks := []string{FrameworkDart, FrameworkJS}
		for _, fw := range frameworks {
			exception := Exception{
				Framework: fw,
			}

			got := exception.GetFramework()

			if fw != got {
				t.Errorf("Expected %v, but got %v", fw, got)
			}
		}
	})

	t.Run("Determines Apple framework heuristically when framework is absent", func(t *testing.T) {
		t.Run("Exception without error", func(t *testing.T) {
			exception := Exception{
				Handled: false,
				Exceptions: ExceptionUnits{
					{
						ExceptionUnitiOS: &ExceptionUnitiOS{
							Signal: "SIGABRT",
						},
						Frames: Frames{
							{
								FrameiOS: &FrameiOS{
									BinaryName:    "libsystem_kernel.dylib",
									BinaryAddress: "100fcc000",
									Offset:        37128,
									FrameIndex:    0,
									SymbolAddress: "0000000100fd5108",
								},
								InApp: false,
							},
							{
								FrameiOS: &FrameiOS{
									BinaryName:    "libsystem_c.dylib",
									BinaryAddress: "1800fd000",
									Offset:        472300,
									FrameIndex:    1,
									SymbolAddress: "00000001801704ec",
								},
								InApp: false,
							},
						},
					},
				},
				Threads: Threads{
					{
						Name: "Thread 1",
						ThreadiOS: &ThreadiOS{
							Sequence: 1,
						},
						Frames: Frames{
							{
								FrameiOS: &FrameiOS{
									BinaryName:    "libsystem_kernel.dylib",
									BinaryAddress: "100fcc000",
									Offset:        11884,
									FrameIndex:    0,
									SymbolAddress: "0000000100fcee6c",
								},
								InApp: false,
							},
							{
								FrameiOS: &FrameiOS{
									BinaryName:    "libsystem_pthread.dylib",
									BinaryAddress: "100fcc000",
									Offset:        11884,
									FrameIndex:    1,
									SymbolAddress: "0000000100fcee6c",
								},
								InApp: false,
							},
						},
					},
				},
			}

			expected := FrameworkApple
			got := exception.GetFramework()

			if expected != got {
				t.Errorf("Expected %v, but got %v", expected, got)
			}
		})

		t.Run("Exception with error", func(t *testing.T) {
			exception := Exception{
				Handled: true,
				Error: &Error{
					Code: "ENOFILE",
				},
			}

			expected := FrameworkApple
			got := exception.GetFramework()

			if expected != got {
				t.Errorf("Expected %v, but got %v", expected, got)
			}
		})
	})

	t.Run("Determines JVM framework heuristically when framework is absent", func(t *testing.T) {
		exception := Exception{
			Handled: false,
			Exceptions: ExceptionUnits{
				{
					Type:    "java.lang.RuntimeException",
					Message: "java.lang.reflect.InvocationTargetException",
					Frames: Frames{
						{
							LineNum:    558,
							FileName:   "RuntimeInit.java",
							ClassName:  "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
							MethodName: "run",
						},
						{
							ClassName:  "com.android.internal.os.ZygoteInit",
							MethodName: "main",
							FileName:   "ZygoteInit.java",
							LineNum:    936,
						},
					},
				},
			},
			Threads: Threads{
				{
					Name: "ConnectivityThread",
					Frames: Frames{
						{
							ClassName:  "android.os.MessageQueue",
							MethodName: "nativePollOnce",
							FileName:   "MessageQueue.java",
							LineNum:    -2,
						},
						{
							ClassName:  "android.os.MessageQueue",
							MethodName: "next",
							FileName:   "MessageQueue.java",
							LineNum:    335,
						},
					},
				},
			},
			Foreground: true,
		}

		expected := FrameworkJVM
		got := exception.GetFramework()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	})
}

func TestGetSeverity(t *testing.T) {
	t.Run("Returns SeverityFatal for unhandled exception with empty severity", func(t *testing.T) {
		e := Exception{
			Handled:  false,
			Severity: "",
		}
		expected := SeverityFatal
		got := e.GetSeverity()
		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	})

	t.Run("Returns SeverityHandled for handled exception with empty severity", func(t *testing.T) {
		e := Exception{
			Handled:  true,
			Severity: "",
		}
		expected := SeverityHandled
		got := e.GetSeverity()
		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	})

	t.Run("Returns e.Severity if it is not empty", func(t *testing.T) {
		e := Exception{
			Handled:  false,
			Severity: SeverityUnhandled,
		}
		expected := SeverityUnhandled
		got := e.GetSeverity()
		if got != expected {
			t.Errorf("Expected %v, but got %v", expected, got)
		}
	})
}

func TestIsFatalException(t *testing.T) {
	t.Run("Returns true for an exception with SeverityFatal", func(t *testing.T) {
		e := EventField{
			Type: TypeException,
			Exception: &Exception{
				Severity: SeverityFatal,
			},
		}

		if !e.IsFatalException() {
			t.Errorf("Expected IsFatalException to be true, got false")
		}
	})

	t.Run("Returns false for an exception with non-fatal severity", func(t *testing.T) {
		e := EventField{
			Type: TypeException,
			Exception: &Exception{
				Severity: SeverityHandled,
			},
		}

		if e.IsFatalException() {
			t.Errorf("Expected IsFatalException to be false, got true")
		}
	})

	t.Run("Returns false if event is not an exception", func(t *testing.T) {
		e := EventField{
			Type: TypeANR,
			ANR:  &ANR{},
		}

		if e.IsFatalException() {
			t.Errorf("Expected IsFatalException to be false, got true")
		}
	})

	t.Run("Returns true for an exception when unhandled and empty severity (implied fatal)", func(t *testing.T) {
		e := EventField{
			Type: TypeException,
			Exception: &Exception{
				Handled:  false,
				Severity: "",
			},
		}

		if !e.IsFatalException() {
			t.Errorf("Expected IsFatalException to be true, got false")
		}
	})
}

func TestGetMetaBytes(t *testing.T) {
	t.Run("Returns e.Meta as bytes if e.Meta is not nil", func(t *testing.T) {
		e := Exception{
			Meta: map[string]any{
				"key1": "value1",
			},
			Error: &Error{
				Meta: map[string]any{
					"key2": "value2",
				},
			},
		}

		bytes, err := e.GetMetaBytes()
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		expected := `{"key1":"value1"}`
		if string(bytes) != expected {
			t.Errorf("Expected %s, got %s", expected, string(bytes))
		}
	})

	t.Run("Returns e.Error.Meta as bytes if e.Meta is nil and e.Error.Meta is not nil", func(t *testing.T) {
		e := Exception{
			Error: &Error{
				Meta: map[string]any{
					"key2": "value2",
				},
			},
		}

		bytes, err := e.GetMetaBytes()
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		expected := `{"key2":"value2"}`
		if string(bytes) != expected {
			t.Errorf("Expected %s, got %s", expected, string(bytes))
		}
	})

	t.Run("Returns nil bytes and nil err if both are nil", func(t *testing.T) {
		e := Exception{}

		bytes, err := e.GetMetaBytes()
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if bytes != nil {
			t.Errorf("Expected nil bytes, got %s", string(bytes))
		}
	})

	t.Run("Returns error if marshaling fails", func(t *testing.T) {
		e := Exception{
			Meta: map[string]any{
				"key": make(chan int),
			},
		}

		_, err := e.GetMetaBytes()
		if err == nil {
			t.Errorf("Expected error during marshaling, got nil")
		}
	})
}

func TestHasJSFrames(t *testing.T) {
	t.Run("Returns true for JS exception with frames", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkJS,
			Exceptions: ExceptionUnits{
				{
					Frames: Frames{
						{MethodName: "render"},
					},
				},
			},
		}

		if !e.HasJSFrames() {
			t.Errorf("Expected HasJSFrames to return true, got false")
		}
	})

	t.Run("Returns false for JS exception with no frames", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkJS,
			Exceptions: ExceptionUnits{
				{
					Frames: Frames{},
				},
			},
		}

		if e.HasJSFrames() {
			t.Errorf("Expected HasJSFrames to return false, got true")
		}
	})

	t.Run("Returns false for JS exception with no exception units", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkJS,
		}

		if e.HasJSFrames() {
			t.Errorf("Expected HasJSFrames to return false, got true")
		}
	})

	t.Run("Returns false for non-JS framework with frames", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkDart,
			Exceptions: ExceptionUnits{
				{
					Frames: Frames{
						{MethodName: "main"},
					},
				},
			},
		}

		if e.HasJSFrames() {
			t.Errorf("Expected HasJSFrames to return false for non-JS framework, got true")
		}
	})
}

func TestValidateAppleFrameworkOSName(t *testing.T) {
	makeEvent := func(osName string) EventField {
		return EventField{
			ID:        uuid.New(),
			AppID:     uuid.New(),
			Type:      TypeException,
			Timestamp: time.Now(),
			Attribute: Attribute{OSName: osName},
			Exception: &Exception{
				Framework: FrameworkApple,
				Exceptions: ExceptionUnits{
					{
						Type: "EXC_BAD_ACCESS",
						ExceptionUnitiOS: &ExceptionUnitiOS{
							Signal: "SIGSEGV",
						},
						Frames: Frames{{}},
					},
				},
				Threads: Threads{
					{Name: "main", Frames: Frames{{}}},
				},
			},
		}
	}

	t.Run("Rejects apple framework on non-Apple os_name", func(t *testing.T) {
		ev := makeEvent("android")
		if err := ev.Validate(); err == nil {
			t.Error("Expected validation error for apple framework with android os_name, got nil")
		}
	})

	t.Run("Accepts apple framework on Apple os_name", func(t *testing.T) {
		ev := makeEvent("ios")
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error for apple framework with ios os_name, got %v", err)
		}
	})
}

func TestValidateAttachmentLimit(t *testing.T) {
	makeEvent := func(n int) EventField {
		attachments := make([]Attachment, n)
		for i := range attachments {
			attachments[i] = Attachment{
				ID:   uuid.New(),
				Name: "screenshot.png",
				Type: "screenshot",
			}
		}
		return EventField{
			ID:          uuid.New(),
			AppID:       uuid.New(),
			Type:        TypeString,
			Timestamp:   time.Now(),
			Attribute:   Attribute{OSName: "android"},
			LogString:   &LogString{String: "log line"},
			Attachments: attachments,
		}
	}

	t.Run("Accepts event with no attachments", func(t *testing.T) {
		ev := makeEvent(0)
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error for 0 attachments, got %v", err)
		}
	})

	t.Run("Accepts event at the attachment limit", func(t *testing.T) {
		ev := makeEvent(maxEventAttachments)
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error for %d attachments, got %v", maxEventAttachments, err)
		}
	})

	t.Run("Rejects event over the attachment limit", func(t *testing.T) {
		ev := makeEvent(maxEventAttachments + 1)
		if err := ev.Validate(); err == nil {
			t.Errorf("Expected validation error for %d attachments, got nil", maxEventAttachments+1)
		}
	})
}

func TestValidateLogSeverity(t *testing.T) {
	makeLog := func(severityText string, severityNumber int32) EventField {
		return EventField{
			ID:        uuid.New(),
			AppID:     uuid.New(),
			Type:      TypeLog,
			Timestamp: time.Now(),
			Attribute: Attribute{OSName: "android"},
			Log: &Log{
				SeverityText:   severityText,
				SeverityNumber: severityNumber,
				Body:           "something happened",
			},
		}
	}

	t.Run("Accepts fatal severity", func(t *testing.T) {
		ev := makeLog("fatal", 24)
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error for fatal severity, got %v", err)
		}
	})

	t.Run("Rejects unknown severity", func(t *testing.T) {
		ev := makeLog("verbose", 4)
		if err := ev.Validate(); err == nil {
			t.Error("Expected validation error for unknown severity, got nil")
		}
	})

	t.Run("Rejects severity_number that does not match severity_text", func(t *testing.T) {
		ev := makeLog("fatal", 20)
		if err := ev.Validate(); err == nil {
			t.Error("Expected validation error for mismatched severity_number, got nil")
		}
	})
}

func TestComputeFingerprint(t *testing.T) {
	t.Run("FrameworkJS with message", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkJS,
			Exceptions: ExceptionUnits{
				{
					Type:    "TypeError",
					Message: "Cannot read property 'foo' of undefined",
					Frames: Frames{
						{
							MethodName: "render",
							FileName:   "App.js",
						},
					},
				},
			},
		}

		err := e.ComputeFingerprint()
		if err != nil {
			t.Fatalf("Unexpected error computing JS fingerprint: %v", err)
		}

		expected := "a8c01be01b06e5284186a69934ec04f6"
		if e.Fingerprint != expected {
			t.Errorf("Expected fingerprint %q, but got %q", expected, e.Fingerprint)
		}
	})

	t.Run("FrameworkJS with different message", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkJS,
			Exceptions: ExceptionUnits{
				{
					Type:    "TypeError",
					Message: "Cannot read property 'bar' of undefined",
					Frames: Frames{
						{
							MethodName: "render",
							FileName:   "App.js",
						},
					},
				},
			},
		}

		err := e.ComputeFingerprint()
		if err != nil {
			t.Fatalf("Unexpected error computing JS fingerprint: %v", err)
		}

		expected := "56f894bf670623086c843b1d462c5c44"
		if e.Fingerprint != expected {
			t.Errorf("Expected fingerprint %q, but got %q", expected, e.Fingerprint)
		}
	})

	t.Run("FrameworkJS with empty message", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkJS,
			Exceptions: ExceptionUnits{
				{
					Type:    "TypeError",
					Message: "",
					Frames: Frames{
						{
							MethodName: "render",
							FileName:   "App.js",
						},
					},
				},
			},
		}

		err := e.ComputeFingerprint()
		if err != nil {
			t.Fatalf("Unexpected error computing JS fingerprint: %v", err)
		}

		expected := "f7a09ac70683ba3a38cc8dbf537d51b4"
		if e.Fingerprint != expected {
			t.Errorf("Expected fingerprint %q, but got %q", expected, e.Fingerprint)
		}
	})

	t.Run("FrameworkDart with invalid double message", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkDart,
			Exceptions: ExceptionUnits{
				{
					Type:    "FormatException",
					Message: "Invalid double",
					Frames: Frames{
						{
							MethodName: "parseDouble",
							FileName:   "parser.dart",
						},
					},
				},
			},
		}

		err := e.ComputeFingerprint()
		if err != nil {
			t.Fatalf("Unexpected error computing Dart fingerprint: %v", err)
		}

		expected := "20bb2b941c29aefcd6b81b2cba2d3511"
		if e.Fingerprint != expected {
			t.Errorf("Expected fingerprint %q, but got %q", expected, e.Fingerprint)
		}
	})

	t.Run("FrameworkDart with invalid float message (retains same fingerprint)", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkDart,
			Exceptions: ExceptionUnits{
				{
					Type:    "FormatException",
					Message: "Invalid float",
					Frames: Frames{
						{
							MethodName: "parseDouble",
							FileName:   "parser.dart",
						},
					},
				},
			},
		}

		err := e.ComputeFingerprint()
		if err != nil {
			t.Fatalf("Unexpected error computing Dart fingerprint: %v", err)
		}

		expected := "20bb2b941c29aefcd6b81b2cba2d3511"
		if e.Fingerprint != expected {
			t.Errorf("Expected fingerprint %q, but got %q", expected, e.Fingerprint)
		}
	})

	t.Run("FrameworkJVM with nested exceptions uses innermost", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkJVM,
			Exceptions: ExceptionUnits{
				{
					Type:    "java.lang.RuntimeException",
					Message: "Nested exception wrapper",
					Frames: Frames{
						{
							MethodName: "outerMethod",
							FileName:   "OuterClass.java",
						},
					},
				},
				{
					Type:    "java.lang.NullPointerException",
					Message: "Null pointer occurred",
					Frames: Frames{
						{
							MethodName: "innerMethod",
							FileName:   "InnerClass.java",
						},
					},
				},
			},
		}

		err := e.ComputeFingerprint()
		if err != nil {
			t.Fatalf("Unexpected error computing JVM fingerprint: %v", err)
		}

		expected := "a74cd8f37b38b20c7505f5da3bc83df3"
		if e.Fingerprint != expected {
			t.Errorf("Expected fingerprint %q, but got %q", expected, e.Fingerprint)
		}
	})

	t.Run("FrameworkApple selects relevant in-app frame", func(t *testing.T) {
		e := Exception{
			Framework: FrameworkApple,
			Exceptions: ExceptionUnits{
				{
					ExceptionUnitiOS: &ExceptionUnitiOS{
						Signal: "SIGABRT",
					},
					Frames: Frames{
						{
							MethodName: "systemMethod",
							FileName:   "libsystem_kernel.dylib",
							InApp:      false,
						},
						{
							MethodName: "myInAppMethod",
							FileName:   "ViewController.swift",
							InApp:      true,
						},
					},
				},
			},
		}

		err := e.ComputeFingerprint()
		if err != nil {
			t.Fatalf("Unexpected error computing Apple fingerprint: %v", err)
		}

		expected := "53f373bcd16b29f5033e1c4477a8f5cd"
		if e.Fingerprint != expected {
			t.Errorf("Expected fingerprint %q, but got %q", expected, e.Fingerprint)
		}
	})
}

func TestANRComputeFingerprint(t *testing.T) {
	t.Run("ANR with nested exceptions uses innermost", func(t *testing.T) {
		a := ANR{
			Exceptions: ExceptionUnits{
				{
					Type: "AppNotResponding",
					Frames: Frames{
						{
							MethodName: "systemWait",
							FileName:   "native.c",
						},
					},
				},
				{
					Type: "MainThreadBlocked",
					Frames: Frames{
						{
							MethodName: "blockerMethod",
							FileName:   "MainActivity.java",
						},
					},
				},
			},
		}

		err := a.ComputeFingerprint()
		if err != nil {
			t.Fatalf("Unexpected error computing ANR fingerprint: %v", err)
		}

		expected := "575ddc443e854d811e7e1b2b04868356"
		if a.Fingerprint != expected {
			t.Errorf("Expected fingerprint %q, but got %q", expected, a.Fingerprint)
		}
	})
}

func TestValidateANR(t *testing.T) {
	makeANR := func(anr ANR) EventField {
		return EventField{
			ID:        uuid.New(),
			AppID:     uuid.New(),
			Type:      TypeANR,
			Timestamp: time.Now(),
			Attribute: Attribute{OSName: "android"},
			ANR:       &anr,
		}
	}

	withExceptions := ANR{
		Exceptions: ExceptionUnits{
			{
				Type: "AppNotResponding",
				Frames: Frames{
					{
						MethodName: "blockerMethod",
						FileName:   "MainActivity.java",
					},
				},
			},
		},
		Threads: Threads{
			{
				Name: "main",
				Frames: Frames{
					{
						MethodName: "blockerMethod",
						FileName:   "MainActivity.java",
					},
				},
			},
		},
	}

	withThreadDump := ANR{
		ArtThreadDump: "DALVIK THREADS (1):\n\"main\" prio=5 tid=1 Blocked\n  at sh.foo.Repo.load(Repo.kt:8)\n",
		Subject:       "Broadcast of Intent { cmp=sh.foo/.Receiver }",
	}

	t.Run("Accepts an anr with a thread dump and no exceptions", func(t *testing.T) {
		ev := makeANR(withThreadDump)
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error for a dump-only anr, got %v", err)
		}
	})

	t.Run("Accepts an anr with exceptions and no thread dump", func(t *testing.T) {
		ev := makeANR(withExceptions)
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error for a stacktrace anr, got %v", err)
		}
	})

	t.Run("Accepts an anr with a thread dump and no subject", func(t *testing.T) {
		anr := withThreadDump
		anr.Subject = ""
		ev := makeANR(anr)
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error for a dump without a subject, got %v", err)
		}
	})

	t.Run("Accepts an anr carrying both representations", func(t *testing.T) {
		anr := withExceptions
		anr.ArtThreadDump = withThreadDump.ArtThreadDump
		ev := makeANR(anr)
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error for an anr with both representations, got %v", err)
		}
	})

	t.Run("Rejects an anr with exceptions but no threads", func(t *testing.T) {
		anr := withExceptions
		anr.Threads = nil
		ev := makeANR(anr)
		if err := ev.Validate(); err == nil {
			t.Error("Expected validation error for a stacktrace anr with no threads, got nil")
		}
	})

	t.Run("Rejects an anr with neither a thread dump nor exceptions", func(t *testing.T) {
		ev := makeANR(ANR{Subject: "Input dispatching timed out"})
		if err := ev.Validate(); err == nil {
			t.Error("Expected validation error for an anr carrying only a subject, got nil")
		}
	})

	t.Run("Accepts a thread dump at the size limit", func(t *testing.T) {
		anr := withThreadDump
		anr.ArtThreadDump = strings.Repeat("a", maxANRThreadDumpBytes)
		ev := makeANR(anr)
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error for a dump of %d bytes, got %v", maxANRThreadDumpBytes, err)
		}
	})

	t.Run("Rejects a thread dump over the size limit", func(t *testing.T) {
		anr := withThreadDump
		anr.ArtThreadDump = strings.Repeat("a", maxANRThreadDumpBytes+1)
		ev := makeANR(anr)
		if err := ev.Validate(); err == nil {
			t.Errorf("Expected validation error for a dump of %d bytes, got nil", maxANRThreadDumpBytes+1)
		}
	})

	t.Run("Accepts a subject at the size limit", func(t *testing.T) {
		anr := withThreadDump
		anr.Subject = strings.Repeat("a", maxANRSubjectBytes)
		ev := makeANR(anr)
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error for a subject of %d bytes, got %v", maxANRSubjectBytes, err)
		}
	})

	t.Run("Rejects a subject over the size limit", func(t *testing.T) {
		anr := withThreadDump
		anr.Subject = strings.Repeat("a", maxANRSubjectBytes+1)
		ev := makeANR(anr)
		if err := ev.Validate(); err == nil {
			t.Errorf("Expected validation error for a subject of %d bytes, got nil", maxANRSubjectBytes+1)
		}
	})
}

// Main thread blocked in application code, below two frames that are not
// application code and one native frame.
const inAppStall = `"main" prio=5 tid=1 Blocked
  native: #00 pc 0004df5c  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+28)
  at android.os.MessageQueue.nativePollOnce(Native method)
  at sh.foo.Repo.load(Repo.kt:8)
  at android.app.ActivityThread.main(ActivityThread.java:8280)`

// Main thread parked in the looper, which is what an ANR that did not
// stall the main thread looks like.
const idleMain = `"main" prio=5 tid=1 Native
  at android.os.MessageQueue.nativePollOnce(Native method)
  at android.os.Looper.loopOnce(Looper.java:161)`

const noManagedFramesMain = `"main" prio=5 tid=1 Native
  (no managed stack frames)`

const (
	inputSubject     = "user request after error: Input dispatching timed out (7e1b6d2 sh.foo/.MainActivity (server) is not responding. Waited 5001ms for MotionEvent)"
	broadcastSubject = "user request after error: Broadcast of Intent { flg=0x10000010 cmp=sh.foo/.Receiver }"
	unknownSubject   = "the process ended for reasons this parser does not recognise"
)

func dumpANR(subject, dump string) ANR {
	parsed := artdump.Parse(dump)
	parsed.MarkInApp()
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
// can assert on the fingerprint input rather than on an opaque digest.
func hashOf(input string) string {
	hash := md5.Sum([]byte(input))
	return hex.EncodeToString(hash[:])
}

func TestANRDumpFingerprint(t *testing.T) {
	t.Run("Groups on the main thread's first in-app frame", func(t *testing.T) {
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
		got := fingerprintOf(t, dumpANR(unknownSubject, noManagedFramesMain))
		if got != "" {
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
				{
					Type: "art",
					Frames: Frames{
						{MethodName: "load", FileName: "Repo.kt"},
					},
				},
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
				{
					Type: "AppNotResponding",
					Frames: Frames{
						{MethodName: "blockerMethod", FileName: "MainActivity.java"},
					},
				},
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

	t.Run("Groups on the first managed frame below the native ones", func(t *testing.T) {
		nativeFirst := `"main" prio=5 tid=1 Native
  native: #00 pc 0004df5c  /apex/com.android.runtime/lib64/bionic/libc.so (syscall+28)
  native: #01 pc 000d1a90  /system/lib64/libandroid_runtime.so (???)
  at android.os.MessageQueue.nativePollOnce(Native method)`
		anr := dumpANR(inputSubject, nativeFirst)

		if got, want := anr.GetMethodName(), "nativePollOnce"; got != want {
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

	t.Run("Reads the exceptions when an anr carries both representations", func(t *testing.T) {
		both := ANR{
			Exceptions: ExceptionUnits{
				{
					Type:    "AppNotResponding",
					Message: "Application Not Responding",
					Frames: Frames{
						{MethodName: "blockerMethod", FileName: "MainActivity.java", LineNum: 42},
					},
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

	t.Run("HasNoFrames reflects the main thread", func(t *testing.T) {
		if stalled.HasNoFrames() {
			t.Error("Expected the stalled main thread to have frames")
		}
		if !idle.HasNoFrames() {
			t.Error("Expected the idle main thread to have no frames")
		}
	})

	t.Run("Stacktrace renders the main thread", func(t *testing.T) {
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

func TestANRGetDisplayTitle(t *testing.T) {
	t.Run("Joins type and file name", func(t *testing.T) {
		anr := dumpANR(inputSubject, inAppStall)
		if got, want := anr.GetDisplayTitle(), "Input dispatching timed out@Repo.kt"; got != want {
			t.Errorf("Expected display title %q, but got %q", want, got)
		}
	})

	t.Run("Omits the separator when there is no type", func(t *testing.T) {
		anr := dumpANR(unknownSubject, inAppStall)
		if got, want := anr.GetDisplayTitle(), "Repo.kt"; got != want {
			t.Errorf("Expected display title %q, but got %q", want, got)
		}
	})

	t.Run("Omits the separator when there is no file name", func(t *testing.T) {
		anr := dumpANR(inputSubject, noManagedFramesMain)
		if got, want := anr.GetDisplayTitle(), "Input dispatching timed out"; got != want {
			t.Errorf("Expected display title %q, but got %q", want, got)
		}
	})
}

func TestComputeViewRendersTheThreadDump(t *testing.T) {
	dump := `"main" prio=5 tid=1 Blocked
  at sh.foo.Repo.load(Repo.kt:8)
  - waiting to lock <0x053dd6df> (a java.lang.Object) held by thread 46
DumpLatencyMs: 2.47

"APP: Locker" daemon prio=5 tid=46 Sleeping
  at java.lang.Thread.sleep(Native method)
  - sleeping on <0x07c5c2d7> (a java.lang.Object)
  native: #00 pc 0004df5c  /apex/libc.so (syscall+28)`

	e := EventANR{ANR: dumpANR(inputSubject, dump)}
	e.ComputeView()

	t.Run("Carries the subject", func(t *testing.T) {
		if got, want := e.ANRView.Subject, inputSubject; got != want {
			t.Errorf("Expected subject %q, but got %q", want, got)
		}
	})

	t.Run("Leaves the main thread out of the thread list", func(t *testing.T) {
		// The detail page renders it above this list from Stacktrace,
		// so including it here shows the stalled thread twice.
		if len(e.Threads) != 1 {
			t.Fatalf("Expected 1 thread beside main, but got %d", len(e.Threads))
		}
		if got, want := e.Threads[0].Name, `"APP: Locker" daemon prio=5 tid=46 Sleeping`; got != want {
			t.Errorf("Expected thread name %q, but got %q", want, got)
		}
	})

	t.Run("Names the thread holding a lock", func(t *testing.T) {
		want := "  - waiting to lock <0x053dd6df> (a java.lang.Object) held by APP: Locker"
		if !strings.Contains(e.ANRView.Stacktrace, want) {
			t.Errorf("Expected the main thread stack to contain %q, got:\n%s", want, e.ANRView.Stacktrace)
		}
	})

	t.Run("Keeps a lock beneath the frame it annotates", func(t *testing.T) {
		want := []string{
			"  at java.lang.Thread.sleep(Native method)",
			"  - sleeping on <0x07c5c2d7> (a java.lang.Object)",
			"  native: #00 pc 0004df5c  /apex/libc.so (syscall+28)",
		}
		if got := e.Threads[0].Frames; !reflect.DeepEqual(got, want) {
			t.Errorf("Expected frames %q, but got %q", want, got)
		}
	})

	t.Run("Leaves a stacktrace ANR on the existing shape", func(t *testing.T) {
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
	})
}
