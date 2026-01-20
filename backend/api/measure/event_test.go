//go:build integration

package measure

import (
	"backend/api/event"
	"backend/api/span"
	"testing"
)

func TestEventReqOnboardable(t *testing.T) {
	// Not onboardable when no events or spans
	{
		eventReq := &eventreq{}

		if eventReq.onboardable() {
			t.Errorf("Expected eventReq to be not onboardable")
		}
	}

	// Onboardable when at least 1 event
	{
		eventReq := &eventreq{
			events: []event.EventField{
				{
					Type: event.TypeString,
				},
			},
		}

		if !eventReq.onboardable() {
			t.Errorf("Expected eventReq to be onboardable")
		}
	}

	// Onboardable when at least 1 span
	{
		eventReq := &eventreq{
			spans: []span.SpanField{
				{
					SpanName: "some-span",
				},
			},
		}

		if !eventReq.onboardable() {
			t.Errorf("Expected eventReq to be onboardable")
		}
	}
}

func TestEventReqGetOSName(t *testing.T) {
	// Can extract os name from ingest batch containing
	// only events.
	{
		eventReq := &eventreq{
			events: []event.EventField{
				{
					Type: event.TypeString,
					Attribute: event.Attribute{
						OSName: "Android",
					},
				},
			},
		}

		osName := eventReq.getOSName()
		if osName != "android" {
			t.Errorf("Expected OS name to be 'android', got '%s'", osName)
		}
	}

	// Can extract os version from ingest batch containing
	// only events.
	{
		eventReq := &eventreq{
			events: []event.EventField{
				{
					Type: event.TypeString,
					Attribute: event.Attribute{
						OSVersion: "33",
					},
				},
			},
		}

		osVersion := eventReq.getOSVersion()
		if osVersion != "33" {
			t.Errorf("Expected OS version to be '33', got '%s'", osVersion)
		}
	}

	// Can extract app unique id from ingest batch
	// containing only events.
	{
		eventReq := &eventreq{
			events: []event.EventField{
				{
					Type: event.TypeString,
					Attribute: event.Attribute{
						AppUniqueID: "sh.measure.test",
					},
				},
			},
		}

		appUniqueID := eventReq.getAppUniqueID()
		if appUniqueID != "sh.measure.test" {
			t.Errorf("Expected app unique id to be 'sh.measure.test', got '%s'", appUniqueID)
		}
	}

	// Can extract os name from ingest batch containing
	// only spans.
	{
		eventReq := &eventreq{
			spans: []span.SpanField{
				{
					Attributes: span.SpanAttributes{
						OSName: "Android",
					},
				},
			},
		}

		osName := eventReq.getOSName()
		if osName != "android" {
			t.Errorf("Expected OS Name to be 'android', got '%s'", osName)
		}
	}

	// Can extract os version from ingest batch containing
	// only spans.
	{
		eventReq := &eventreq{
			spans: []span.SpanField{
				{
					Attributes: span.SpanAttributes{
						OSVersion: "33",
					},
				},
			},
		}

		osVersion := eventReq.getOSVersion()
		if osVersion != "33" {
			t.Errorf("Expected OS version to be '33', got '%s'", osVersion)
		}
	}

	// Can extract app unique id from ingest batch
	// containing only spans.
	{
		eventReq := &eventreq{
			spans: []span.SpanField{
				{
					Attributes: span.SpanAttributes{
						AppUniqueID: "sh.measure.test",
					},
				},
			},
		}

		appUniqueID := eventReq.getAppUniqueID()
		if appUniqueID != "sh.measure.test" {
			t.Errorf("Expected app unique id to be 'sh.measure.test', got '%s'", appUniqueID)
		}
	}
}
