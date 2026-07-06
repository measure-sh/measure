package slack

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// TestConversationRepliesPaginatesToNewest checks that a thread split across
// pages is followed to the end and the sliding tail keeps the newest limit
// messages, not the first page's oldest ones.
func TestConversationRepliesPaginatesToNewest(t *testing.T) {
	orig := httpClient
	defer func() { httpClient = orig }()

	// Three pages of two messages each (m1..m6), oldest first, chained by cursor.
	pages := map[string]string{
		"":   `{"ok":true,"messages":[{"ts":"1","text":"m1"},{"ts":"2","text":"m2"}],"has_more":true,"response_metadata":{"next_cursor":"c2"}}`,
		"c2": `{"ok":true,"messages":[{"ts":"3","text":"m3"},{"ts":"4","text":"m4"}],"has_more":true,"response_metadata":{"next_cursor":"c3"}}`,
		"c3": `{"ok":true,"messages":[{"ts":"5","text":"m5"},{"ts":"6","text":"m6"}],"has_more":false}`,
	}
	calls := 0
	httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		body, ok := pages[r.URL.Query().Get("cursor")]
		if !ok {
			t.Fatalf("unexpected cursor %q", r.URL.Query().Get("cursor"))
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     make(http.Header),
		}, nil
	})}

	got, err := ConversationReplies(context.Background(), "tok", "C1", "1.0", "", 3)
	if err != nil {
		t.Fatalf("ConversationReplies: %v", err)
	}
	if calls != 3 {
		t.Fatalf("expected 3 pages followed, got %d", calls)
	}
	// limit 3 over m1..m6 keeps the newest three.
	if len(got) != 3 || got[0].Text != "m4" || got[1].Text != "m5" || got[2].Text != "m6" {
		t.Fatalf("expected newest three [m4 m5 m6], got %+v", got)
	}
}

// TestThreadMessageExists checks the aliveness verdicts: a live message
// counts wherever it exists in the thread, deletion is recognized both as a
// missing message and as a root's tombstone, other messages' fates don't
// matter, and an unrelated API failure is reported as an error rather than a
// verdict.
func TestThreadMessageExists(t *testing.T) {
	orig := httpClient
	defer func() { httpClient = orig }()

	cases := map[string]struct {
		threadTS, ts string
		body         string
		exists       bool
		wantsError   bool
	}{
		"live root, no thread": {
			threadTS: "1.0", ts: "1.0",
			body:   `{"ok":true,"messages":[{"ts":"1.0","text":"the question"}]}`,
			exists: true,
		},
		"root tombstoned by deletion": {
			threadTS: "1.0", ts: "1.0",
			body:   `{"ok":true,"messages":[{"ts":"1.0","subtype":"tombstone","text":"This message was deleted."},{"ts":"1.5","text":"the ack"}]}`,
			exists: false,
		},
		"reply alive under deleted root": {
			threadTS: "1.0", ts: "1.4",
			body:   `{"ok":true,"messages":[{"ts":"1.0","subtype":"tombstone","text":"This message was deleted."},{"ts":"1.4","text":"the question"},{"ts":"1.6","text":"later chatter"}]}`,
			exists: true,
		},
		"reply deleted": {
			threadTS: "1.0", ts: "1.4",
			body:   `{"ok":true,"messages":[{"ts":"1.0","text":"the root"},{"ts":"1.6","text":"later chatter"}]}`,
			exists: false,
		},
		"thread not found": {
			threadTS: "1.0", ts: "1.0",
			body:   `{"ok":false,"error":"thread_not_found"}`,
			exists: false,
		},
		"api failure": {
			threadTS: "1.0", ts: "1.0",
			body:   `{"ok":false,"error":"fatal_error"}`,
			exists: false, wantsError: true,
		},
	}
	for name, tc := range cases {
		httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			q := r.URL.Query()
			if q.Get("ts") != tc.threadTS || q.Get("oldest") != tc.ts || q.Get("inclusive") != "true" {
				t.Errorf("%s: query = %s, want ts=%s oldest=%s inclusive=true", name, q.Encode(), tc.threadTS, tc.ts)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(tc.body)),
				Header:     make(http.Header),
			}, nil
		})}
		exists, err := ThreadMessageExists(context.Background(), "tok", "C1", tc.threadTS, tc.ts)
		if tc.wantsError != (err != nil) {
			t.Errorf("%s: err = %v, wantsError = %v", name, err, tc.wantsError)
		}
		if exists != tc.exists {
			t.Errorf("%s: exists = %v, want %v", name, exists, tc.exists)
		}
	}
}

// TestConversationRepliesStopsWithoutCursor checks the loop ends on a single
// page that reports no more.
func TestConversationRepliesStopsWithoutCursor(t *testing.T) {
	orig := httpClient
	defer func() { httpClient = orig }()

	calls := 0
	httpClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		const body = `{"ok":true,"messages":[{"ts":"1","text":"only"}],"has_more":false}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(body)),
			Header:     make(http.Header),
		}, nil
	})}

	got, err := ConversationReplies(context.Background(), "tok", "C1", "1.0", "", 25)
	if err != nil {
		t.Fatalf("ConversationReplies: %v", err)
	}
	if calls != 1 {
		t.Fatalf("expected a single page, got %d calls", calls)
	}
	if len(got) != 1 || got[0].Text != "only" {
		t.Fatalf("expected [only], got %+v", got)
	}
}
