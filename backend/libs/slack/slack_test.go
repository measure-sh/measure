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
