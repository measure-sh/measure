package slack

import "testing"

func TestEscapeMrkdwn(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"ampersand", "Food & Drink", "Food &amp; Drink"},
		{"less than", "x < 1", "x &lt; 1"},
		{"greater than", "rate > 2%", "rate &gt; 2%"},
		{"angle bracket pair", "<init>", "&lt;init&gt;"},
		{"already encoded entity keeps its ampersand escaped", "&lt;", "&amp;lt;"},
		{"no control characters", "plain text", "plain text"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := EscapeMrkdwn(tc.in); got != tc.want {
				t.Fatalf("EscapeMrkdwn(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestUnescapeMrkdwn(t *testing.T) {
	in := "crash rate &gt; 2% in Food &amp; Drink, &lt;init&gt;"
	want := "crash rate > 2% in Food & Drink, <init>"
	if got := UnescapeMrkdwn(in); got != want {
		t.Fatalf("UnescapeMrkdwn(%q) = %q, want %q", in, got, want)
	}
}

func TestEscapeUnescapeRoundTrip(t *testing.T) {
	in := "<Foo & Bar> says x < 1 && y > 2"
	if got := UnescapeMrkdwn(EscapeMrkdwn(in)); got != in {
		t.Fatalf("round trip changed the text: got %q, want %q", got, in)
	}
}
