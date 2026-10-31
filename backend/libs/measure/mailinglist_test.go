//go:build integration

package measure

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	resendtest "backend/libs/resend/testhelpers"

	"github.com/google/uuid"
)

func TestMailingListEvents(t *testing.T) {
	ctx := context.Background()
	acceptResend := func(t *testing.T) {
		resendtest.Enable(t)
		resendtest.MockSubscribe(t, func(context.Context, string, string) error { return nil })
		resendtest.MockUnsubscribe(t, func(context.Context, string) error { return nil })
	}

	t.Run("opting in and out from the dashboard fires both events for the user", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		acceptResend(t)
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
			if evt["distinct_id"] != userID.String() {
				t.Errorf("%s distinct_id = %v, want the user id", event, evt["distinct_id"])
			}
			props, _ := evt["properties"].(map[string]any)
			if props["attribution"] != attribution || props["schema_version"] != "v1" {
				t.Errorf("%s properties = %v, want attribution %s", event, props, attribution)
			}
		}
	})

	t.Run("no event when Resend fails", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		resendtest.Enable(t)
		resendtest.MockSubscribe(t, func(context.Context, string, string) error { return errors.New("resend down") })
		cap, cleanup := startPostHogStub(t)
		defer cleanup()

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "ada@example.com")

		if err := SetMailingListSubscription(ctx, deps.PgPool, userID, true, "settings"); err == nil {
			t.Fatal("want an error")
		}
		flushPostHog()

		if cap.hasEvent("mailing_list_subscribed") {
			t.Error("event fired although nothing was saved")
		}
	})

	t.Run("an unsubscribe found through Resend fires unsubscribed with the unsubscribe link attribution", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		acceptResend(t)
		resendtest.MockContactSubscribed(t, func(context.Context, string) (bool, error) { return false, nil })
		cap, cleanup := startPostHogStub(t)
		defer cleanup()

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "ada@example.com")
		if err := SetMailingListSubscription(ctx, deps.PgPool, userID, true, "signup"); err != nil {
			t.Fatalf("opt in: %v", err)
		}

		if subscribed, err := MailingListSubscribed(ctx, deps.PgPool, userID); err != nil || subscribed {
			t.Fatalf("subscribed = %v, err = %v, want false", subscribed, err)
		}
		flushPostHog()

		evt, found := cap.findEvent("mailing_list_unsubscribed")
		if !found {
			t.Fatal("mailing_list_unsubscribed not captured")
		}
		props, _ := evt["properties"].(map[string]any)
		if props["attribution"] != MailingListAttributionUnsubscribeLink {
			t.Errorf("attribution = %v, want %s", props["attribution"], MailingListAttributionUnsubscribeLink)
		}
	})

	t.Run("confirming a blog signup without an account never sends the address", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		acceptResend(t)
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
		sum := sha256.Sum256([]byte("reader@example.com"))
		if want := "mailing_list:" + hex.EncodeToString(sum[:]); evt["distinct_id"] != want {
			t.Errorf("distinct_id = %v, want %s", evt["distinct_id"], want)
		}
		props, _ := evt["properties"].(map[string]any)
		if props["attribution"] != "blog" || props["$process_person_profile"] != false {
			t.Errorf("properties = %v, want attribution blog without a person profile", props)
		}
		raw, _ := json.Marshal(evt)
		if strings.Contains(string(raw), "reader@example.com") {
			t.Error("the email address was sent to PostHog")
		}
	})

	t.Run("confirming a blog signup for a Measure user fires for that user", func(t *testing.T) {
		defer cleanupAll(ctx, t)
		acceptResend(t)
		cap, cleanup := startPostHogStub(t)
		defer cleanup()

		userID := uuid.New()
		seedUser(ctx, t, userID.String(), "Ada@Example.com")
		token, err := RequestMailingListSignup(ctx, deps.PgPool, "ada@example.com", "blog")
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
		if evt["distinct_id"] != userID.String() {
			t.Errorf("distinct_id = %v, want the user id", evt["distinct_id"])
		}
	})
}
