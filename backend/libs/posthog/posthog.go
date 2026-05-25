// Package posthog is a fire-and-forget client wrapping the official posthog-go
// SDK. The SDK handles batching and async transport; this package only adds
// init/skip semantics consistent with backend/libs/ga4 so callers can fire
// events without worrying about whether PostHog is configured.
package posthog

import (
	"log"
	"sync"

	ph "github.com/posthog/posthog-go"
)

var (
	client ph.Client

	// notInitWarn ensures Capture logs the "not initialized" warning at most
	// once per process; the SDK is intentionally a no-op when apiKey is empty
	// and we don't want the log to dominate output in self-hosted setups.
	notInitWarn sync.Once
)

// Init configures the PostHog client. Must be called once at startup before
// any Capture; not safe to call concurrently with Capture. An empty apiKey
// makes Capture a no-op. Empty host falls back to the SDK default
// (posthog.DefaultEndpoint).
func Init(apiKey, host string) {
	if apiKey == "" {
		client = nil
		return
	}

	c, err := ph.NewWithConfig(apiKey, ph.Config{
		Endpoint: host,
	})
	if err != nil {
		log.Printf("posthog: init: %v", err)
		client = nil
		return
	}
	client = c
}

// Capture sends an event via the posthog-go SDK. Fire-and-forget: the SDK
// batches internally so this call is non-blocking.
//
// Skips silently if distinctID is empty or Init was not called. Callers are
// responsible for adding `schema_version` to props.
func Capture(distinctID, eventName string, props map[string]any, groups map[string]string) {
	if distinctID == "" {
		return
	}

	c := client
	if c == nil {
		notInitWarn.Do(func() {
			log.Printf("posthog: not initialized, skipping capture (this message logs once)")
		})
		return
	}

	msg := ph.Capture{
		DistinctId: distinctID,
		Event:      eventName,
		Properties: ph.Properties(props),
	}

	if len(groups) > 0 {
		g := ph.NewGroups()
		for k, v := range groups {
			g.Set(k, v)
		}
		msg.Groups = g
	}

	if err := c.Enqueue(msg); err != nil {
		log.Printf("posthog: enqueue: %v", err)
	}
}

// Close flushes any pending events and shuts down the SDK client. Call once
// on graceful server shutdown. Safe when Init was not called.
func Close() {
	c := client
	if c == nil {
		return
	}
	if err := c.Close(); err != nil {
		log.Printf("posthog: close: %v", err)
	}
	client = nil
}
