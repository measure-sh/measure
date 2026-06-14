// Package ga4 is a fire-and-forget client for Google Analytics 4's
// Measurement Protocol.
//
// Configure with Init() at startup, then call Send() from anywhere. Send
// spawns its own goroutine with a fresh 5s timeout context so it survives
// caller-context cancellation (e.g. HTTP request completion). Failures are
// logged but never returned.
package ga4

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("ga4-client")

// endpointBase is the GA4 Measurement Protocol collection endpoint.
// Tests reassign this to point at httptest.NewServer.
var endpointBase = "https://www.google-analytics.com/mp/collect"

// SetEndpointBase overrides the Measurement Protocol endpoint URL and returns
// the previous value so callers can restore it. Intended only for tests.
func SetEndpointBase(url string) (prev string) {
	prev = endpointBase
	endpointBase = url
	return prev
}

var (
	cfgMeasurement string
	cfgAPISecret   string

	notInitWarn sync.Once

	httpClient = &http.Client{
		Transport: &http.Transport{
			MaxIdleConns:        16,
			MaxIdleConnsPerHost: 8,
			IdleConnTimeout:     90 * time.Second,
		},
	}
)

// Init configures the GA4 Measurement Protocol client. Must be called once at
// startup before any Send; not safe to call concurrently with Send. Either
// argument empty makes Send a no-op.
func Init(measurementID, apiSecret string) {
	cfgMeasurement = measurementID
	cfgAPISecret = apiSecret
}

type ga4Event struct {
	Name   string         `json:"name"`
	Params map[string]any `json:"params,omitempty"`
}

type ga4Payload struct {
	ClientID string     `json:"client_id"`
	UserID   string     `json:"user_id,omitempty"`
	Events   []ga4Event `json:"events"`
}

// Send fires a GA4 event. Returns immediately; the actual HTTP call runs in
// a goroutine with its own 5s timeout, decoupled from the caller's ctx
// cancellation. Trace context from ctx is propagated to the goroutine span.
func Send(ctx context.Context, clientID, userID, eventName string, params map[string]any) {
	if clientID == "" {
		return
	}

	measurementID := cfgMeasurement
	apiSecret := cfgAPISecret

	if measurementID == "" || apiSecret == "" {
		notInitWarn.Do(func() {
			log.Printf("ga4: not initialized, skipping send (this message logs once)")
		})
		return
	}

	go send(ctx, measurementID, apiSecret, clientID, userID, eventName, params)
}

func send(parentCtx context.Context, measurementID, apiSecret, clientID, userID, eventName string, params map[string]any) {
	// Build a fresh background context with a 5s timeout, but inherit any
	// trace metadata from the caller so spans link up.
	bgCtx := context.Background()
	if parentCtx != nil {
		if sc := trace.SpanContextFromContext(parentCtx); sc.IsValid() {
			bgCtx = trace.ContextWithSpanContext(bgCtx, sc)
		}
	}
	ctx, cancel := context.WithTimeout(bgCtx, 5*time.Second)
	defer cancel()

	ctx, span := tracer.Start(ctx, "ga4.send")
	defer span.End()
	span.SetAttributes(attribute.String("event.name", eventName))

	payload := ga4Payload{
		ClientID: clientID,
		UserID:   userID,
		Events:   []ga4Event{{Name: eventName, Params: params}},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		log.Printf("ga4: marshal payload: %v", err)
		return
	}

	q := url.Values{}
	q.Set("measurement_id", measurementID)
	q.Set("api_secret", apiSecret)
	reqURL := endpointBase + "?" + q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(body))
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		log.Printf("ga4: build request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		log.Printf("ga4: send: %v", err)
		return
	}
	defer resp.Body.Close()

	span.SetAttributes(attribute.Int("http.status_code", resp.StatusCode))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		span.SetStatus(codes.Error, http.StatusText(resp.StatusCode))
		log.Printf("ga4: non-2xx response: status=%d", resp.StatusCode)
	}
}
