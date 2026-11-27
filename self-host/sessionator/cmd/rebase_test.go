package cmd

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/tidwall/gjson"
)

func writeBatch(t *testing.T, dir, name, body string) string {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestRebaseMovesLatestToNowAndKeepsGaps(t *testing.T) {
	dir := t.TempDir()
	a := writeBatch(t, dir, "b.json", `{"events":[{"timestamp":"2026-01-01T10:00:00Z"}]}`)
	b := writeBatch(t, dir, "a.json", `{"events":[{"timestamp":"2026-01-01T10:05:00.123Z"}],"spans":[{"start_time":"2026-01-01T10:04:00Z","end_time":"2026-01-01T10:06:00Z"}]}`)

	now := time.Date(2026, 11, 27, 12, 0, 0, 0, time.UTC)
	r, err := newTimeRebaser([]string{a, b}, now)
	if err != nil {
		t.Fatal(err)
	}

	span := json.RawMessage(`{"start_time":"2026-01-01T10:04:00Z","end_time":"2026-01-01T10:06:00Z","checkpoints":[{"name":"x","timestamp":"2026-01-01T10:05:00Z"}],"attributes":{"session_start_time":"2026-01-01T09:59:00Z"}}`)
	if err := r.Span(&span); err != nil {
		t.Fatal(err)
	}
	if got := gjson.GetBytes(span, "end_time").Str; got != "2026-11-27T12:00:00Z" {
		t.Errorf("latest end_time = %s, want now", got)
	}
	if got := gjson.GetBytes(span, "checkpoints.0.timestamp").Str; got != "2026-11-27T11:59:00Z" {
		t.Errorf("checkpoint = %s", got)
	}
	if got := gjson.GetBytes(span, "attributes.session_start_time").Str; got != "2026-11-27T11:53:00Z" {
		t.Errorf("span session_start_time = %s", got)
	}

	ev := json.RawMessage(`{"id":"1","timestamp":"2026-01-01T10:05:00.123Z","attribute":{"session_start_time":"0001-01-01T00:00:00Z"}}`)
	if err := r.Event(&ev); err != nil {
		t.Fatal(err)
	}
	if got := gjson.GetBytes(ev, "timestamp").Str; got != "2026-11-27T11:59:00.123Z" {
		t.Errorf("event timestamp = %s", got)
	}
	if got := gjson.GetBytes(ev, "attribute.session_start_time").Str; got != "0001-01-01T00:00:00Z" {
		t.Errorf("zero session_start_time changed to %s", got)
	}

	files := []string{b, a}
	if err := sortByFirstTimestamp(files); err != nil {
		t.Fatal(err)
	}
	if files[0] != a {
		t.Errorf("want earliest batch first, got %v", files)
	}
}
