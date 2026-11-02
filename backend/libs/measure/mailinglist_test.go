//go:build integration

package measure

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestMailingListEvents(t *testing.T) {
	ctx := context.Background()

	t.Run("opting in and out from the dashboard fires both events with their attribution", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		cap, cleanup := startPostHogStub(t)
		defer cleanup()

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "Ada@Example.com")

		if err := SetMailingListSubscription(ctx, deps.PgPool, userID, true, "signup"); err != nil {
			t.Fatalf("opt in: %v", err)
		}
		if err := SetMailingListSubscription(ctx, deps.PgPool, userID, false, "settings"); err != nil {
			t.Fatalf("opt out: %v", err)
		}
		flushPostHog()

		for event, attribution := range map[string]string{"mailing_list_subscribed": "signup", "mailing_list_unsubscribed": "settings"} {
			evt, found := cap.findEvent(event)
			if !found {
				t.Fatalf("%s not captured", event)
			}
			if evt["distinct_id"] != "mailing_list" {
				t.Errorf("%s distinct_id = %v, want mailing_list", event, evt["distinct_id"])
			}
			props, _ := evt["properties"].(map[string]any)
			if props["attribution"] != attribution || props["schema_version"] != "v1" || props["$process_person_profile"] != false {
				t.Errorf("%s properties = %v, want attribution %s without a person profile", event, props, attribution)
			}
		}
	})

	t.Run("confirming a blog signup fires subscribed with the blog attribution", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		cap, cleanup := startPostHogStub(t)
		defer cleanup()

		token, err := RequestMailingListSignup(ctx, deps.PgPool, "reader@example.com", "blog")
		if err != nil {
			t.Fatalf("request: %v", err)
		}
		if err := ConfirmMailingListSignup(ctx, deps.PgPool, token); err != nil {
			t.Fatalf("confirm: %v", err)
		}
		flushPostHog()

		evt, found := cap.findEvent("mailing_list_subscribed")
		if !found {
			t.Fatal("mailing_list_subscribed not captured")
		}
		props, _ := evt["properties"].(map[string]any)
		if evt["distinct_id"] != "mailing_list" || props["attribution"] != "blog" {
			t.Errorf("event = %v, want distinct_id mailing_list and attribution blog", evt)
		}
	})
}
