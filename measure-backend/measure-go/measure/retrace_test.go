package measure

import (
	"reflect"
	"testing"
)

func TestRetraceMarshaling(t *testing.T) {
	defaultFrame := Frame{
		ClassName:  "foo.bar.baz",
		FileName:   "some-file.java",
		MethodName: "method",
		LineNum:    10,
	}
	defaultExpected := "foo.bar.baz.method(some-file.java:10)"
	defaultResult := MarshalRetraceFrame(defaultFrame, "")

	if defaultResult != defaultExpected {
		t.Errorf("Expected '%s' but got '%s'", defaultExpected, defaultResult)
	}

	prefixFrame := Frame{
		ClassName:  "foo.bar.baz",
		FileName:   "some-file.java",
		MethodName: "method",
		LineNum:    10,
	}
	prefixExpected := "\tat foo.bar.baz.method(some-file.java:10)"
	prefixResult := MarshalRetraceFrame(prefixFrame, "\tat ")

	if prefixResult != prefixExpected {
		t.Errorf("Expected '%s' but got '%s'", prefixExpected, prefixResult)
	}

	noLineNums := Frame{
		ClassName:  "foo.bar.baz",
		FileName:   "some-file.java",
		MethodName: "method",
	}
	noLineExpected := "foo.bar.baz.method(some-file.java)"
	noLineResult := MarshalRetraceFrame(noLineNums, "")
	if noLineResult != noLineExpected {
		t.Errorf("Expected '%s' but got '%s'", noLineExpected, noLineResult)
	}

	noFile := Frame{
		ClassName:  "foo.bar.baz",
		MethodName: "method",
	}
	noFileExpected := "foo.bar.baz.method"
	noFileResult := MarshalRetraceFrame(noFile, "")
	if noFileResult != noFileExpected {
		t.Errorf("Expected '%s' but got '%s'", noFileExpected, noFileResult)
	}
}

func TestRetraceUnmarshaling(t *testing.T) {
	defaultFrame := "foo.bar.baz.method(some-file.java:10)"
	defaultExpected := RetraceFrame{
		ClassName:  "foo.bar.baz",
		MethodName: "method",
		FileName:   "some-file.java",
		LineNum:    10,
	}
	defaultResult, _ := UnmarshalRetraceFrame(defaultFrame, "")
	if !reflect.DeepEqual(defaultExpected, defaultResult) {
		t.Errorf("Expected %+v but got %+v", defaultExpected, defaultResult)
	}

	prefixFrame := "\tat foo.bar.baz.method(some-file.java:10)"
	prefixExpected := RetraceFrame{
		ClassName:  "foo.bar.baz",
		MethodName: "method",
		FileName:   "some-file.java",
		LineNum:    10,
	}
	prefixResult, _ := UnmarshalRetraceFrame(prefixFrame, "\tat ")
	if !reflect.DeepEqual(prefixExpected, prefixResult) {
		t.Errorf("Expected %+v but got %+v", prefixExpected, prefixResult)
	}

	noLineFrame := "foo.bar.baz.method(some-file.java)"
	noLineExpected := RetraceFrame{
		ClassName:  "foo.bar.baz",
		MethodName: "method",
		FileName:   "some-file.java",
	}
	noLineResult, _ := UnmarshalRetraceFrame(noLineFrame, "")
	if !reflect.DeepEqual(noLineExpected, noLineResult) {
		t.Errorf("Expected %+v but got %+v", noLineExpected, noLineResult)
	}

	noFileFrame := "foo.bar.baz.method"
	noFileExpected := RetraceFrame{
		ClassName:  "foo.bar.baz",
		MethodName: "method",
	}
	noFileResult, _ := UnmarshalRetraceFrame(noFileFrame, "")
	if !reflect.DeepEqual(noFileExpected, noFileResult) {
		t.Errorf("Expected %+v but got %+v", noFileExpected, noFileResult)
	}
}
