package event

import (
	"encoding/json"
	"os"
	"testing"
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
		exception := Exception{
			Framework: FrameworkDart,
		}

		expected := FrameworkDart
		got := exception.GetFramework()

		if expected != got {
			t.Errorf("Expected %v, but got %v", expected, got)
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
