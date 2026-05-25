package ga4

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
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
	origM, origS := cfgMeasurement, cfgAPISecret
	origEndpoint := endpointBase
	cfgMeasurement, cfgAPISecret = "", ""
	// New sync.Once for each test so the "not initialized" path logs again.
	notInitWarn = sync.Once{}
	return func() {
		cfgMeasurement, cfgAPISecret = origM, origS
		endpointBase = origEndpoint
		notInitWarn = sync.Once{}
	}
}

// startServer wires up a test server, sets endpointBase, and returns the
// channel each request lands in plus a closer.
func startServer(t *testing.T, handler http.HandlerFunc) (*httptest.Server, chan struct{}) {
	t.Helper()
	hit := make(chan struct{}, 4)
	wrapped := func(w http.ResponseWriter, r *http.Request) {
		handler(w, r)
		hit <- struct{}{}
	}
	ts := httptest.NewServer(http.HandlerFunc(wrapped))
	endpointBase = ts.URL + "/mp/collect"
	return ts, hit
}

func waitForHit(t *testing.T, hit chan struct{}, d time.Duration) bool {
	t.Helper()
	select {
	case <-hit:
		return true
	case <-time.After(d):
		return false
	}
}

func TestSend_Success(t *testing.T) {
	defer reset(t)()

	type capture struct {
		path        string
		query       url.Values
		contentType string
		payload     ga4Payload
		raw         map[string]any
	}
	var got capture

	ts, hit := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		got.path = r.URL.Path
		got.query = r.URL.Query()
		got.contentType = r.Header.Get("Content-Type")
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &got.payload)
		_ = json.Unmarshal(body, &got.raw)
		w.WriteHeader(http.StatusNoContent)
	})
	defer ts.Close()

	Init("G-TEST", "secret_abc")
	Send(context.Background(), "client-1", "user-1", "signup", map[string]any{
		"plan": "pro",
		"seat": 3,
	})

	if !waitForHit(t, hit, 2*time.Second) {
		t.Fatal("server never received request")
	}

	if got.path != "/mp/collect" {
		t.Errorf("path = %q, want /mp/collect", got.path)
	}
	if mid := got.query.Get("measurement_id"); mid != "G-TEST" {
		t.Errorf("measurement_id = %q, want G-TEST", mid)
	}
	if sec := got.query.Get("api_secret"); sec != "secret_abc" {
		t.Errorf("api_secret = %q, want secret_abc", sec)
	}
	if !strings.HasPrefix(got.contentType, "application/json") {
		t.Errorf("content-type = %q, want application/json", got.contentType)
	}
	if got.payload.ClientID != "client-1" {
		t.Errorf("client_id = %q, want client-1", got.payload.ClientID)
	}
	if got.payload.UserID != "user-1" {
		t.Errorf("user_id = %q, want user-1", got.payload.UserID)
	}
	if len(got.payload.Events) != 1 || got.payload.Events[0].Name != "signup" {
		t.Fatalf("events = %+v, want one event named signup", got.payload.Events)
	}
	if got.payload.Events[0].Params["plan"] != "pro" {
		t.Errorf("params.plan = %v, want pro", got.payload.Events[0].Params["plan"])
	}
}

func TestSend_EmptyClientID_NoHTTPCall(t *testing.T) {
	defer reset(t)()
	var called atomic.Bool
	ts, _ := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		called.Store(true)
		w.WriteHeader(http.StatusNoContent)
	})
	defer ts.Close()

	Init("G-TEST", "secret_abc")
	Send(context.Background(), "", "u", "event", nil)

	// Give any (incorrect) goroutine a chance to actually fire.
	time.Sleep(150 * time.Millisecond)
	if called.Load() {
		t.Error("server was hit despite empty clientID")
	}
}

func TestSend_NotInitialized_NoHTTPCall(t *testing.T) {
	defer reset(t)()
	var called atomic.Bool
	ts, _ := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		called.Store(true)
		w.WriteHeader(http.StatusNoContent)
	})
	defer ts.Close()

	// Capture log output to assert the one-time warning fires.
	var buf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&buf)
	defer log.SetOutput(origOut)

	// First call with neither measurementID nor apiSecret set: should warn.
	Send(context.Background(), "client-1", "", "event", nil)
	// Second call should NOT log again.
	Send(context.Background(), "client-1", "", "event", nil)

	time.Sleep(150 * time.Millisecond)
	if called.Load() {
		t.Error("server was hit despite missing init")
	}

	logged := buf.String()
	if !strings.Contains(logged, "ga4: not initialized") {
		t.Errorf("expected 'not initialized' warning in logs, got: %q", logged)
	}
	if strings.Count(logged, "ga4: not initialized") != 1 {
		t.Errorf("warning should log exactly once; got %d occurrences in %q",
			strings.Count(logged, "ga4: not initialized"), logged)
	}
}

func TestSend_OnlyMeasurementIDSet_NoHTTPCall(t *testing.T) {
	defer reset(t)()
	var called atomic.Bool
	ts, _ := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		called.Store(true)
		w.WriteHeader(http.StatusNoContent)
	})
	defer ts.Close()

	Init("G-TEST", "")
	Send(context.Background(), "client-1", "", "event", nil)

	time.Sleep(150 * time.Millisecond)
	if called.Load() {
		t.Error("server was hit despite empty apiSecret")
	}
}

func TestSend_4xx_NoPanic(t *testing.T) {
	defer reset(t)()
	ts, hit := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"bad"}`))
	})
	defer ts.Close()

	var buf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&buf)
	defer log.SetOutput(origOut)

	Init("G-TEST", "secret_abc")
	Send(context.Background(), "client-1", "user-1", "event", nil)

	if !waitForHit(t, hit, 2*time.Second) {
		t.Fatal("server never received request")
	}
	// Small grace period for the goroutine to finish reading + logging.
	time.Sleep(100 * time.Millisecond)

	if !strings.Contains(buf.String(), "non-2xx response") {
		t.Errorf("expected non-2xx warning in logs, got: %q", buf.String())
	}
}

func TestSend_5xx_NoPanic(t *testing.T) {
	defer reset(t)()
	ts, hit := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	})
	defer ts.Close()

	var buf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&buf)
	defer log.SetOutput(origOut)

	Init("G-TEST", "secret_abc")
	Send(context.Background(), "client-1", "user-1", "event", nil)

	if !waitForHit(t, hit, 2*time.Second) {
		t.Fatal("server never received request")
	}
	time.Sleep(100 * time.Millisecond)

	if !strings.Contains(buf.String(), "non-2xx response") {
		t.Errorf("expected non-2xx warning in logs, got: %q", buf.String())
	}
}

func TestSend_Timeout(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping timeout test in short mode")
	}
	defer reset(t)()

	// Shorten the production 5s timeout to 200ms for tests by overriding
	// the http client's per-attempt deadline via the context.
	// We do this by serving a slow handler and using a stand-in client
	// with a short transport-level timeout that mirrors the contract.
	// To keep this fast: install a stall server, then override httpClient
	// briefly with a 200ms-Timeout client.

	stallStart := make(chan struct{})
	releaseServer := make(chan struct{})
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(stallStart)
		<-releaseServer
		w.WriteHeader(http.StatusNoContent)
	}))
	defer ts.Close()
	defer close(releaseServer)
	endpointBase = ts.URL + "/mp/collect"

	origClient := httpClient
	httpClient = &http.Client{Timeout: 200 * time.Millisecond}
	defer func() { httpClient = origClient }()

	var buf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&buf)
	defer log.SetOutput(origOut)

	Init("G-TEST", "secret_abc")
	Send(context.Background(), "client-1", "user-1", "event", nil)

	select {
	case <-stallStart:
	case <-time.After(2 * time.Second):
		t.Fatal("server never received request")
	}

	// Wait for the client timeout + a grace window for the goroutine to log.
	time.Sleep(500 * time.Millisecond)

	logged := buf.String()
	if !strings.Contains(logged, "ga4: send:") {
		t.Errorf("expected send-failure warning in logs, got: %q", logged)
	}
}

func TestSend_NoUserID_OmitsField(t *testing.T) {
	defer reset(t)()

	var rawBody []byte
	ts, hit := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		rawBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusNoContent)
	})
	defer ts.Close()

	Init("G-TEST", "secret_abc")
	Send(context.Background(), "client-1", "", "event", map[string]any{"k": "v"})

	if !waitForHit(t, hit, 2*time.Second) {
		t.Fatal("server never received request")
	}

	// Assert user_id is absent from the encoded JSON (not just empty).
	var generic map[string]any
	if err := json.Unmarshal(rawBody, &generic); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if _, ok := generic["user_id"]; ok {
		t.Errorf("user_id should be omitted from payload, body was: %s", rawBody)
	}
	if generic["client_id"] != "client-1" {
		t.Errorf("client_id mismatch in body: %s", rawBody)
	}
}

func TestSend_SurvivesCancelledCallerContext(t *testing.T) {
	defer reset(t)()

	var rxClientID string
	ts, hit := startServer(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var p ga4Payload
		_ = json.Unmarshal(body, &p)
		rxClientID = p.ClientID
		w.WriteHeader(http.StatusNoContent)
	})
	defer ts.Close()

	Init("G-TEST", "secret_abc")
	ctx, cancel := context.WithCancel(context.Background())
	Send(ctx, "client-1", "user-1", "event", nil)
	cancel() // immediate cancel — goroutine must still complete.

	if !waitForHit(t, hit, 2*time.Second) {
		t.Fatal("server never received request despite caller-ctx cancel")
	}
	if rxClientID != "client-1" {
		t.Errorf("client_id = %q, want client-1", rxClientID)
	}
}

func TestInit_LastCallWins(t *testing.T) {
	defer reset(t)()
	Init("G-FIRST", "s1")
	Init("G-SECOND", "s2")

	if cfgMeasurement != "G-SECOND" || cfgAPISecret != "s2" {
		t.Errorf("after second Init: (%q,%q), want (G-SECOND,s2)", cfgMeasurement, cfgAPISecret)
	}
}
