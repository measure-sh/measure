package event

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

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
		e := Exception{
			NumCode: 47,
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

func TestValidateAnrLimits(t *testing.T) {
	makeANR := func(artThreadDump, subject string) EventField {
		return EventField{
			ID:        uuid.New(),
			AppID:     uuid.New(),
			Type:      TypeANR,
			Timestamp: time.Now(),
			Attribute: Attribute{OSName: "android"},
			ANR: &ANR{
				Exceptions:    ExceptionUnits{{}},
				Threads:       Threads{{}},
				ARTThreadDump: artThreadDump,
				Subject:       subject,
			},
		}
	}

	t.Run("Accepts art thread dump and subject within limits", func(t *testing.T) {
		ev := makeANR("DALVIK THREADS (1):", "Input dispatching timed out")
		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error, got %v", err)
		}
	})

	t.Run("Rejects oversized art thread dump", func(t *testing.T) {
		ev := makeANR(strings.Repeat("a", maxAnrArtThreadDumpChars+1), "")
		if err := ev.Validate(); err == nil {
			t.Error("Expected validation error for oversized art thread dump, got nil")
		}
	})

	t.Run("Rejects oversized subject", func(t *testing.T) {
		ev := makeANR("", strings.Repeat("a", maxAnrSubjectChars+1))
		if err := ev.Validate(); err == nil {
			t.Error("Expected validation error for oversized subject, got nil")
		}
	})

	t.Run("Accepts an ANR carrying only a thread dump", func(t *testing.T) {
		ev := makeANR("DALVIK THREADS (1):", "Input dispatching timed out")
		ev.ANR.Exceptions = ExceptionUnits{}
		ev.ANR.Threads = Threads{}

		if err := ev.Validate(); err != nil {
			t.Errorf("Expected no validation error, got %v", err)
		}
	})

	t.Run("Rejects an ANR carrying neither a stacktrace nor a thread dump", func(t *testing.T) {
		ev := makeANR("", "")
		ev.ANR.Exceptions = ExceptionUnits{}
		ev.ANR.Threads = Threads{}

		if err := ev.Validate(); err == nil {
			t.Error("Expected validation error for an ANR with no stacktrace or thread dump, got nil")
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

		expected := "bf7d2a45a2ce63b457874198096cc8e9"
		if a.Fingerprint != expected {
			t.Errorf("Expected fingerprint %q, but got %q", expected, a.Fingerprint)
		}
	})

	t.Run("groups an ANR without a single frame by its reason", func(t *testing.T) {
		waitedLonger := ingestedANR(nativeStalledANR("Input dispatching timed out (71005a5 sh.frankenstein.android/sh.frankenstein.android.MainActivity is not responding. Waited 5005ms for MotionEvent)."))
		waitedShorter := ingestedANR(nativeStalledANR("Input dispatching timed out (8813f2b sh.frankenstein.android/sh.frankenstein.android.MainActivity is not responding. Waited 10009ms for MotionEvent)."))
		otherDeadline := ingestedANR(nativeStalledANR("No response to onStartJob for sh.frankenstein.android/.AnrJobService"))

		for _, a := range []*ANR{&waitedLonger, &waitedShorter, &otherDeadline} {
			if err := a.ComputeFingerprint(); err != nil {
				t.Fatalf("Unexpected error computing ANR fingerprint: %v", err)
			}
		}

		if waitedLonger.Fingerprint != waitedShorter.Fingerprint {
			t.Errorf("Expected the same fingerprint, but got %q and %q", waitedLonger.Fingerprint, waitedShorter.Fingerprint)
		}
		if waitedLonger.Fingerprint == otherDeadline.Fingerprint {
			t.Errorf("Expected different fingerprints, but both were %q", waitedLonger.Fingerprint)
		}
	})

	t.Run("leaves an ANR nothing identifies without a fingerprint", func(t *testing.T) {
		a := ANR{}

		if err := a.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error computing ANR fingerprint: %v", err)
		}
		if a.Fingerprint != "" {
			t.Errorf("Expected no fingerprint, but got %q", a.Fingerprint)
		}
	})

	t.Run("groups a recovered ANR with one carrying a stacktrace", func(t *testing.T) {
		recovered := ingestedANR(recoveredANR("No response to onStartJob for sh.frankenstein.android/.AnrJobService"))
		inProcess := ingestedANR(anrStalledIn("java.lang.Thread", "sleep", "onStartJob"))

		if err := recovered.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error computing ANR fingerprint: %v", err)
		}
		if err := inProcess.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error computing ANR fingerprint: %v", err)
		}

		if recovered.Fingerprint != inProcess.Fingerprint {
			t.Errorf("Expected the same fingerprint, but got %q and %q", recovered.Fingerprint, inProcess.Fingerprint)
		}
	})

	t.Run("separates stalls in different app methods", func(t *testing.T) {
		first := anrStalledIn("java.lang.Thread", "sleep", "onStartJob")
		second := anrStalledIn("java.lang.Thread", "sleep", "onHandleWork")

		if err := first.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error computing ANR fingerprint: %v", err)
		}
		if err := second.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error computing ANR fingerprint: %v", err)
		}

		if first.Fingerprint == second.Fingerprint {
			t.Errorf("Expected different fingerprints, but both were %q", first.Fingerprint)
		}
	})

	t.Run("groups one app method stalling on different platform calls", func(t *testing.T) {
		first := anrStalledIn("java.lang.Thread", "sleep", "onStartJob")
		second := anrStalledIn("android.os.BinderProxy", "transactNative", "onStartJob")

		if err := first.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error computing ANR fingerprint: %v", err)
		}
		if err := second.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error computing ANR fingerprint: %v", err)
		}

		if first.Fingerprint != second.Fingerprint {
			t.Errorf("Expected the same fingerprint, but got %q and %q", first.Fingerprint, second.Fingerprint)
		}
	})
}

// anrStalledIn builds an ANR whose main thread sits in a platform
// call made from the given app method.
func anrStalledIn(platformClass, platformMethod, appMethod string) ANR {
	return ANR{
		Exceptions: ExceptionUnits{
			{
				Type:    "sh.measure.android.anr.AnrError",
				Message: "Application Not Responding for at least 5s",
				Frames: Frames{
					{
						ClassName:  platformClass,
						MethodName: platformMethod,
						FileName:   "Thread.java",
						LineNum:    451,
					},
					{
						ClassName:  "sh.frankenstein.android.AnrJobService",
						MethodName: appMethod,
						FileName:   "AnrComponents.kt",
						LineNum:    42,
						InApp:      true,
					},
					{
						ClassName:  "android.os.Handler",
						MethodName: "dispatchMessage",
						FileName:   "Handler.java",
						LineNum:    103,
					},
				},
			},
		},
	}
}

// recoveredANR builds an ANR read from the system's exit record on
// the launch after it, which carries the thread dump and the subject
// but no stacktrace.
func recoveredANR(subject string) ANR {
	return ANR{
		Subject: subject,
		ARTThreadDump: `DALVIK THREADS (2):
"main" prio=5 tid=1 Blocked
  at sh.frankenstein.android.AnrJobService.onStartJob(AnrComponents.kt:42)
`,
	}
}

// nativeStalledANR builds an ANR whose main thread sat in native code,
// leaving the dump without a managed frame to attribute it to.
func nativeStalledANR(subject string) ANR {
	return ANR{
		Subject: subject,
		ARTThreadDump: `DALVIK THREADS (2):
"main" prio=5 tid=1 Native
  at libcore.io.Linux.read(Native method)
`,
	}
}

// ingestedANR runs the preparation the ingest path performs on an ANR
// before it is fingerprinted.
func ingestedANR(a ANR) ANR {
	a.ReadThreadDump()
	a.MarkInAppFrames([]string{"sh.frankenstein.android"})

	return a
}

func TestANRWithoutExceptions(t *testing.T) {
	a := recoveredANR("No response to onStartJob for sh.frankenstein.android/.AnrJobService")
	reason := "No response to onStartJob (sh.frankenstein.android/.AnrJobService)"

	if !a.HasNoFrames() {
		t.Error("Expected the ANR to have no frames")
	}
	if got := a.GetType(); got != "" {
		t.Errorf("Expected no type, but got %q", got)
	}
	if got := a.GetMessage(); got != reason {
		t.Errorf("Expected message %q, but got %q", reason, got)
	}
	if got := a.GetTitle(); got != reason {
		t.Errorf("Expected title %q, but got %q", reason, got)
	}
	if got := a.GetDisplayTitle(); got != reason {
		t.Errorf("Expected display title %q, but got %q", reason, got)
	}
	if got := a.GetFileName(); got != "" {
		t.Errorf("Expected no file name, but got %q", got)
	}
	if got := a.GetMethodName(); got != "" {
		t.Errorf("Expected no method name, but got %q", got)
	}
	if got := a.GetLineNumber(); got != 0 {
		t.Errorf("Expected no line number, but got %d", got)
	}
	if got := a.Stacktrace(); got != "" {
		t.Errorf("Expected no stacktrace, but got %q", got)
	}
}

func TestANRGetMessage(t *testing.T) {
	t.Run("prefers the system's reason", func(t *testing.T) {
		a := anrStalledIn("java.lang.Thread", "sleep", "onStartJob")
		a.Subject = "No response to onStartJob for sh.frankenstein.android/.AnrJobService"

		expected := "No response to onStartJob (sh.frankenstein.android/.AnrJobService)"
		if got := a.GetMessage(); got != expected {
			t.Errorf("Expected message %q, but got %q", expected, got)
		}
	})

	t.Run("falls back to the sdk message without a subject", func(t *testing.T) {
		a := anrStalledIn("java.lang.Thread", "sleep", "onStartJob")

		expected := "Application Not Responding for at least 5s"
		if got := a.GetMessage(); got != expected {
			t.Errorf("Expected message %q, but got %q", expected, got)
		}
	})
}

func TestANRFingerprintIgnoresTheReason(t *testing.T) {
	fingerprintOf := func(t *testing.T, subject string) string {
		t.Helper()
		a := anrStalledIn("java.lang.Thread", "sleep", "onStartJob")
		a.Subject = subject
		if err := a.ComputeFingerprint(); err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		return a.Fingerprint
	}

	t.Run("groups a stall the system never reported", func(t *testing.T) {
		reported := fingerprintOf(t, "No response to onStartJob for sh.frankenstein.android/.AnrJobService")
		unreported := fingerprintOf(t, "")

		if reported != unreported {
			t.Errorf("Expected fingerprint %q, but got %q", reported, unreported)
		}
	})

	t.Run("groups deadlines expiring in the same method", func(t *testing.T) {
		job := fingerprintOf(t, "No response to onStartJob for sh.frankenstein.android/.AnrJobService")
		input := fingerprintOf(t, "Input dispatching timed out (71005a5 sh.frankenstein.android/sh.frankenstein.android.MainActivity is not responding. Waited 5005ms for MotionEvent).")

		if job != input {
			t.Errorf("Expected fingerprint %q, but got %q", job, input)
		}
	})
}

func TestANRGetRelevantFrame(t *testing.T) {
	t.Run("returns the first in app frame", func(t *testing.T) {
		a := anrStalledIn("java.lang.Thread", "sleep", "onStartJob")

		frame := a.GetRelevantFrame()

		if frame.MethodName != "onStartJob" {
			t.Errorf("Expected method %q, but got %q", "onStartJob", frame.MethodName)
		}
		if frame.FileName != "AnrComponents.kt" {
			t.Errorf("Expected file %q, but got %q", "AnrComponents.kt", frame.FileName)
		}
	})

	t.Run("falls back to the first frame outside the platform", func(t *testing.T) {
		a := anrStalledIn("java.lang.Thread", "sleep", "onStartJob")
		a.Exceptions[0].Frames[1].InApp = false

		frame := a.GetRelevantFrame()

		if frame.MethodName != "onStartJob" {
			t.Errorf("Expected method %q, but got %q", "onStartJob", frame.MethodName)
		}
	})

	t.Run("falls back to the top frame when every frame is platform", func(t *testing.T) {
		a := anrStalledIn("java.lang.Thread", "sleep", "onStartJob")
		a.Exceptions[0].Frames[1].InApp = false
		a.Exceptions[0].Frames[1].ClassName = "androidx.work.Worker"

		frame := a.GetRelevantFrame()

		if frame.MethodName != "sleep" {
			t.Errorf("Expected method %q, but got %q", "sleep", frame.MethodName)
		}
	})

	// The dump names onStartJob and the SDK's own capture names
	// onHandleWork, so whichever frame comes back says which won.
	t.Run("prefers the thread dump over the sdk stacktrace", func(t *testing.T) {
		a := anrStalledIn("java.lang.Thread", "sleep", "onHandleWork")
		a.ARTThreadDump = recoveredANR("").ARTThreadDump

		frame := ingestedANR(a).GetRelevantFrame()

		if frame.MethodName != "onStartJob" {
			t.Errorf("Expected method %q, but got %q", "onStartJob", frame.MethodName)
		}
	})

	t.Run("falls back to the sdk stacktrace without a dump", func(t *testing.T) {
		a := anrStalledIn("java.lang.Thread", "sleep", "onHandleWork")

		frame := ingestedANR(a).GetRelevantFrame()

		if frame.MethodName != "onHandleWork" {
			t.Errorf("Expected method %q, but got %q", "onHandleWork", frame.MethodName)
		}
	})

	t.Run("falls back to the sdk stacktrace when the dump has no managed frame", func(t *testing.T) {
		a := anrStalledIn("java.lang.Thread", "sleep", "onHandleWork")
		a.ARTThreadDump = nativeStalledANR("").ARTThreadDump

		frame := ingestedANR(a).GetRelevantFrame()

		if frame.MethodName != "onHandleWork" {
			t.Errorf("Expected method %q, but got %q", "onHandleWork", frame.MethodName)
		}
	})
}

func TestANRMarkInAppFrames(t *testing.T) {
	a := anrStalledIn("java.lang.Thread", "sleep", "onStartJob")
	a.Exceptions[0].Frames[1].InApp = false
	a.Threads = Threads{
		{
			Name: "APP: Locker",
			Frames: Frames{
				{ClassName: "java.lang.Thread", MethodName: "sleep"},
				{ClassName: "sh.frankenstein.android.DeadlockToken", MethodName: "waitForever"},
			},
		},
	}

	a.MarkInAppFrames([]string{"sh.frankenstein.android"})

	if !a.Exceptions[0].Frames[1].InApp {
		t.Error("Expected the app frame of the stacktrace to be marked in app")
	}
	if a.Exceptions[0].Frames[0].InApp {
		t.Error("Expected the platform frame of the stacktrace to not be marked in app")
	}
	if !a.Threads[0].Frames[1].InApp {
		t.Error("Expected the app frame of the thread to be marked in app")
	}
	if a.Threads[0].Frames[0].InApp {
		t.Error("Expected the platform frame of the thread to not be marked in app")
	}
}
