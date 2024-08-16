package text

import (
	"reflect"
	"testing"
)

func TestJoinNonEmptyStrings(t *testing.T) {
	expected := "foo,bar"
	got := JoinNonEmptyStrings(",", "foo", "", "bar", "")
	if expected != got {
		t.Errorf("Expected %q, but got %q", expected, got)
	}

	expected = "foo,bar"
	got = JoinNonEmptyStrings(",", "", "foo", "", "", "bar")
	if expected != got {
		t.Errorf("Expected %q, but got %q", expected, got)
	}

	expected = "foo bar baz"
	got = JoinNonEmptyStrings("", "foo", "", " bar ", "baz")
	if expected != got {
		t.Errorf("Expected %q, but got %q", expected, got)
	}

	expected = ""
	got = JoinNonEmptyStrings(":", "", "", "")
	if expected != got {
		t.Errorf("Expected %q, but got %q", expected, got)
	}
}

func TestSplitTrimEmpty(t *testing.T) {
	expected := []string{"foo", "bar", "baz"}
	got := SplitTrimEmpty("foo,bar,baz", ",")
	if !reflect.DeepEqual(expected, got) {
		t.Errorf("Expected %v, but got %v", expected, got)
	}

	expected = []string{"foo", "bar", "baz"}
	got = SplitTrimEmpty("  foo  ,  bar  , baz  ", ",")
	if !reflect.DeepEqual(expected, got) {
		t.Errorf("Expected %v, but got %v", expected, got)
	}

	expected = []string{"foo"}
	got = SplitTrimEmpty("  foo,    ,,,,  ,,    ,,,, , , , ,   ,", ",")
	if !reflect.DeepEqual(expected, got) {
		t.Errorf("Expected %v, but got %v", expected, got)
	}
}
