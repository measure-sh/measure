package posthog

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// reset wipes package-level state so subtests don't bleed into each other.
// Returns a teardown that restores the previous values.
func reset(t *testing.T) func() {
	t.Helper()
	prev := client
	client = nil
	notInitWarn = sync.Once{}
	return func() {
		// Close anything the test installed and put back the prior client.
		Close()
		client = prev
		notInitWarn = sync.Once{}
	}
}

// startBatchServer returns an httptest server that accepts PostHog batch
// requests at /batch/, surfaces the parsed payload on a channel, and 200s.
func startBatchServer(t *testing.T) (*httptest.Server, chan map[string]any, *atomic.Int64) {
	t.Helper()
	payloads := make(chan map[string]any, 8)
	var hits atomic.Int64
	mux := http.NewServeMux()
	mux.HandleFunc("/batch/", func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		var body map[string]any
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &body)
		payloads <- body
		w.WriteHeader(http.StatusOK)
	})
	ts := httptest.NewServer(mux)
	return ts, payloads, &hits
}

func waitForPayload(t *testing.T, ch chan map[string]any, d time.Duration) map[string]any {
	t.Helper()
	select {
	case p := <-ch:
		return p
	case <-time.After(d):
		t.Fatal("server never received batch request")
		return nil
	}
}

func TestInit_EmptyAPIKey_CaptureIsNoop(t *testing.T) {
	defer reset(t)()

	var buf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&buf)
	defer log.SetOutput(origOut)

	Init("", "")
	if client != nil {
		t.Fatal("expected client to remain nil after Init with empty apiKey")
	}

	// Two captures: must not panic, must log "not initialized" exactly once.
	Capture("user-1", "event", map[string]any{"k": "v"}, nil)
	Capture("user-2", "event", nil, nil)

	logged := buf.String()
	if !strings.Contains(logged, "posthog: not initialized") {
		t.Errorf("expected 'not initialized' warning, got: %q", logged)
	}
	if strings.Count(logged, "posthog: not initialized") != 1 {
		t.Errorf("warning should log exactly once; got %d in %q",
			strings.Count(logged, "posthog: not initialized"), logged)
	}
}

func TestCapture_EmptyDistinctID_NoEnqueue(t *testing.T) {
	defer reset(t)()
	ts, payloads, hits := startBatchServer(t)
	defer ts.Close()

	Init("phc_test", ts.URL)
	Capture("", "event", map[string]any{"k": "v"}, nil)

	// Give the SDK a moment in case it would (incorrectly) batch.
	select {
	case p := <-payloads:
		t.Errorf("unexpected payload sent for empty distinctID: %v", p)
	case <-time.After(200 * time.Millisecond):
		// expected
	}
	if hits.Load() != 0 {
		t.Errorf("hits = %d, want 0", hits.Load())
	}
}

func TestClose_NotInitialized_NoPanic(t *testing.T) {
	defer reset(t)()
	// Must not panic.
	Close()
}

func TestClose_AfterInit_Safe(t *testing.T) {
	defer reset(t)()
	ts, _, _ := startBatchServer(t)
	defer ts.Close()

	Init("phc_test", ts.URL)
	if client == nil {
		t.Fatal("expected client to be set after Init")
	}
	Close()
	if client != nil {
		t.Errorf("expected client to be nil after Close, got %v", client)
	}
	// Second Close is a no-op.
	Close()
}

func TestCapture_SendsToEndpoint(t *testing.T) {
	defer reset(t)()
	ts, payloads, _ := startBatchServer(t)
	defer ts.Close()

	Init("phc_test_key", ts.URL)
	Capture("user-42", "signup_completed", map[string]any{
		"plan":           "pro",
		"schema_version": "v1",
	}, map[string]string{"team": "team-7"})

	// Close forces a flush so we don't have to wait for the 5s interval.
	Close()

	got := waitForPayload(t, payloads, 3*time.Second)
	if got["api_key"] != "phc_test_key" {
		t.Errorf("api_key = %v, want phc_test_key", got["api_key"])
	}

	msgs, ok := got["batch"].([]any)
	if !ok || len(msgs) != 1 {
		t.Fatalf("batch = %v, want one message", got["batch"])
	}
	msg, _ := msgs[0].(map[string]any)
	if msg["event"] != "signup_completed" {
		t.Errorf("event = %v, want signup_completed", msg["event"])
	}
	if msg["distinct_id"] != "user-42" {
		t.Errorf("distinct_id = %v, want user-42", msg["distinct_id"])
	}

	props, _ := msg["properties"].(map[string]any)
	if props["plan"] != "pro" {
		t.Errorf("properties.plan = %v, want pro", props["plan"])
	}
	if props["schema_version"] != "v1" {
		t.Errorf("properties.schema_version = %v, want v1", props["schema_version"])
	}

	// Groups should be embedded into properties as $groups by the SDK.
	groups, _ := props["$groups"].(map[string]any)
	if groups["team"] != "team-7" {
		t.Errorf("$groups.team = %v, want team-7", groups["team"])
	}
}

func TestCapture_NilGroups_NoGroupsField(t *testing.T) {
	defer reset(t)()
	ts, payloads, _ := startBatchServer(t)
	defer ts.Close()

	Init("phc_test", ts.URL)
	Capture("user-1", "event", map[string]any{"k": "v"}, nil)
	Close()

	got := waitForPayload(t, payloads, 3*time.Second)
	msgs, _ := got["batch"].([]any)
	if len(msgs) != 1 {
		t.Fatalf("batch len = %d, want 1", len(msgs))
	}
	msg, _ := msgs[0].(map[string]any)
	props, _ := msg["properties"].(map[string]any)
	if _, has := props["$groups"]; has {
		t.Errorf("$groups should be absent when groups is nil; properties = %v", props)
	}
}

func TestInit_LastCallWins(t *testing.T) {
	defer reset(t)()
	ts, _, _ := startBatchServer(t)
	defer ts.Close()

	Init("phc_first", ts.URL)
	first := client
	Init("phc_second", ts.URL)
	if client == first {
		t.Error("expected new client after second Init, got the same instance")
	}
	if client == nil {
		t.Fatal("client should not be nil after second Init")
	}
}
