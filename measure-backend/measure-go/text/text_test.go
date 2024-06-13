package text

import "testing"

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
}
