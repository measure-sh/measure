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
