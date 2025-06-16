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
	exception, err := readException("./exception_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./exception_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected %q stacktrace, but got %q", expected, got)
	}
}

func TestNestedExceptionStacktraceOne(t *testing.T) {
	exception, err := readException("./nested_exception_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./nested_exception_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected %q stacktrace, but got %q", expected, got)
	}
}

func TestANRStacktraceOne(t *testing.T) {
	anr, err := readANR("./anr_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./anr_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := anr.Stacktrace()

	if expected != got {
		t.Errorf("Expected %q stacktrace, but got %q", expected, got)
	}
}

func TestObfuscatedDartNestedExceptionStacktraceOne(t *testing.T) {
	exception, err := readException("./dart_nested_exception_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./dart_nested_exception_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected %q stacktrace, but got %q", expected, got)
	}
}

func TestObfuscatedDartExceptionStacktraceOne(t *testing.T) {
	exception, err := readException("./dart_exception_one.json")
	if err != nil {
		panic(err)
	}

	expected, err := readStacktrace("./dart_exception_stacktrace_one.txt")
	if err != nil {
		panic(err)
	}
	got := exception.Stacktrace()

	if expected != got {
		t.Errorf("Expected %q stacktrace, but got %q", expected, got)
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
