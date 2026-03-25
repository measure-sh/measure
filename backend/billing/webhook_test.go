//go:build integration

package billing

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v84"
)

// --------------------------------------------------------------------------
// HandleCheckoutCompleted
// --------------------------------------------------------------------------

func TestHandleCheckoutCompleted(t *testing.T) {
	t.Run("upgrades team", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", false)
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		raw, _ := json.Marshal(map[string]any{
			"client_reference_id": teamID.String(),
			"subscription":        map[string]any{"id": "sub_checkout_123"},
		})

		deps := testDeps()
		HandleCheckoutCompleted(ctx, deps, stripe.Event{
			Type: "checkout.session.completed",
			Data: &stripe.EventData{Raw: raw},
		})

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "pro" {
			t.Errorf("plan = %q, want %q", bc.Plan, "pro")
		}
		if bc.StripeSubscriptionID == nil || *bc.StripeSubscriptionID != "sub_checkout_123" {
			t.Errorf("stripe_subscription_id = %v, want %q", bc.StripeSubscriptionID, "sub_checkout_123")
		}
		if !getTeamAllowIngest(ctx, t, teamID) {
			t.Error("allow_ingest should be true after checkout")
		}
		if reason := getTeamIngestBlockedReason(ctx, t, teamID); reason != nil {
			t.Errorf("ingest_blocked_reason = %q, want nil", *reason)
		}
	})
}

func TestHandleCheckoutCompleted_MissingTeamID(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	raw, _ := json.Marshal(map[string]any{
		"subscription": map[string]any{"id": "sub_orphan"},
	})

	deps := testDeps()
	HandleCheckoutCompleted(ctx, deps, stripe.Event{
		Type: "checkout.session.completed",
		Data: &stripe.EventData{Raw: raw},
	})
}

func TestHandleCheckoutCompleted_MissingSubscriptionID(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "webhook-team", true)
	seedTeamBilling(ctx, t, teamID, "free", nil, nil)

	raw, _ := json.Marshal(map[string]any{
		"client_reference_id": teamID.String(),
	})

	deps := testDeps()
	HandleCheckoutCompleted(ctx, deps, stripe.Event{
		Type: "checkout.session.completed",
		Data: &stripe.EventData{Raw: raw},
	})

	bc := getTeamBilling(ctx, t, teamID)
	if bc.Plan != "free" {
		t.Errorf("plan = %q, want %q (should remain free)", bc.Plan, "free")
	}
}

func TestHandleCheckoutCompleted_InvalidJSON(t *testing.T) {
	deps := testDeps()
	HandleCheckoutCompleted(context.Background(), deps, stripe.Event{
		Type: "checkout.session.completed",
		Data: &stripe.EventData{Raw: json.RawMessage(`{invalid`)},
	})
}

// --------------------------------------------------------------------------
// HandleSubscriptionDeleted
// --------------------------------------------------------------------------

func TestHandleSubscriptionDeleted(t *testing.T) {
	t.Run("downgrades team", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_to_delete"))
		seedApp(ctx, t, appID, teamID, 180)

		raw, _ := json.Marshal(map[string]any{"id": "sub_to_delete"})
		deps := testDeps()
		HandleSubscriptionDeleted(ctx, deps, stripe.Event{
			Type: "customer.subscription.deleted",
			Data: &stripe.EventData{Raw: raw},
		})

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q", bc.Plan, "free")
		}
		if bc.StripeSubscriptionID != nil {
			t.Errorf("stripe_subscription_id = %v, want nil", *bc.StripeSubscriptionID)
		}
		if r := getAppRetention(ctx, t, appID); r != FreePlanMaxRetentionDays {
			t.Errorf("app retention = %d, want %d", r, FreePlanMaxRetentionDays)
		}
		// Usage is 0, so ingest should be allowed
		if !getTeamAllowIngest(ctx, t, teamID) {
			t.Error("allow_ingest should be true (usage under free limit)")
		}
		if reason := getTeamIngestBlockedReason(ctx, t, teamID); reason != nil {
			t.Errorf("ingest_blocked_reason = %q, want nil", *reason)
		}
	})
}

func TestHandleSubscriptionDeleted_InvalidJSON(t *testing.T) {
	deps := testDeps()
	HandleSubscriptionDeleted(context.Background(), deps, stripe.Event{
		Type: "customer.subscription.deleted",
		Data: &stripe.EventData{Raw: json.RawMessage(`{invalid`)},
	})
}

func TestHandleSubscriptionDeleted_TeamNotFound(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	raw, _ := json.Marshal(map[string]any{"id": "sub_orphaned_999"})
	deps := testDeps()
	HandleSubscriptionDeleted(ctx, deps, stripe.Event{
		Type: "customer.subscription.deleted",
		Data: &stripe.EventData{Raw: raw},
	})
}

// --------------------------------------------------------------------------
// HandleSubscriptionUpdated
// --------------------------------------------------------------------------

func TestHandleSubscriptionUpdated(t *testing.T) {
	t.Run("canceled downgrades team", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_to_cancel"))
		seedApp(ctx, t, appID, teamID, 180)

		raw, _ := json.Marshal(map[string]any{"id": "sub_to_cancel", "status": "canceled"})
		deps := testDeps()
		HandleSubscriptionUpdated(ctx, deps, stripe.Event{
			Type: "customer.subscription.updated",
			Data: &stripe.EventData{Raw: raw},
		})

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q", bc.Plan, "free")
		}
		if bc.StripeSubscriptionID != nil {
			t.Errorf("stripe_subscription_id = %v, want nil", *bc.StripeSubscriptionID)
		}
		if r := getAppRetention(ctx, t, appID); r != FreePlanMaxRetentionDays {
			t.Errorf("app retention = %d, want %d", r, FreePlanMaxRetentionDays)
		}
		// Usage is 0, so ingest should be allowed
		if !getTeamAllowIngest(ctx, t, teamID) {
			t.Error("allow_ingest should be true (usage under free limit)")
		}
	})

	t.Run("active no change", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_active"))
		seedApp(ctx, t, appID, teamID, 180)

		raw, _ := json.Marshal(map[string]any{"id": "sub_active", "status": "active"})
		deps := testDeps()
		HandleSubscriptionUpdated(ctx, deps, stripe.Event{
			Type: "customer.subscription.updated",
			Data: &stripe.EventData{Raw: raw},
		})

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "pro" {
			t.Errorf("plan = %q, want %q", bc.Plan, "pro")
		}
		if bc.StripeSubscriptionID == nil || *bc.StripeSubscriptionID != "sub_active" {
			t.Errorf("stripe_subscription_id = %v, want %q", bc.StripeSubscriptionID, "sub_active")
		}
		if r := getAppRetention(ctx, t, appID); r != 180 {
			t.Errorf("app retention = %d, want %d (unchanged)", r, 180)
		}
	})

	t.Run("unpaid downgrades team", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_unpaid"))
		seedApp(ctx, t, appID, teamID, 180)

		raw, _ := json.Marshal(map[string]any{"id": "sub_unpaid", "status": "unpaid"})
		deps := testDeps()
		HandleSubscriptionUpdated(ctx, deps, stripe.Event{
			Type: "customer.subscription.updated",
			Data: &stripe.EventData{Raw: raw},
		})

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q", bc.Plan, "free")
		}
		if bc.StripeSubscriptionID != nil {
			t.Errorf("stripe_subscription_id = %v, want nil", *bc.StripeSubscriptionID)
		}
		if r := getAppRetention(ctx, t, appID); r != FreePlanMaxRetentionDays {
			t.Errorf("app retention = %d, want %d", r, FreePlanMaxRetentionDays)
		}
	})

	t.Run("incomplete_expired downgrades team", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_ie"))
		seedApp(ctx, t, appID, teamID, 180)

		raw, _ := json.Marshal(map[string]any{"id": "sub_ie", "status": "incomplete_expired"})
		deps := testDeps()
		HandleSubscriptionUpdated(ctx, deps, stripe.Event{
			Type: "customer.subscription.updated",
			Data: &stripe.EventData{Raw: raw},
		})

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q", bc.Plan, "free")
		}
	})

	t.Run("past_due does not downgrade", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_past_due"))

		raw, _ := json.Marshal(map[string]any{"id": "sub_past_due", "status": "past_due"})
		deps := testDeps()
		HandleSubscriptionUpdated(ctx, deps, stripe.Event{
			Type: "customer.subscription.updated",
			Data: &stripe.EventData{Raw: raw},
		})

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "pro" {
			t.Errorf("plan = %q, want %q (should remain pro)", bc.Plan, "pro")
		}
	})

	t.Run("incomplete does not downgrade", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "webhook-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_incomplete"))

		raw, _ := json.Marshal(map[string]any{"id": "sub_incomplete", "status": "incomplete"})
		deps := testDeps()
		HandleSubscriptionUpdated(ctx, deps, stripe.Event{
			Type: "customer.subscription.updated",
			Data: &stripe.EventData{Raw: raw},
		})

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "pro" {
			t.Errorf("plan = %q, want %q (should remain pro)", bc.Plan, "pro")
		}
	})
}

func TestHandleSubscriptionUpdated_InvalidJSON(t *testing.T) {
	deps := testDeps()
	HandleSubscriptionUpdated(context.Background(), deps, stripe.Event{
		Type: "customer.subscription.updated",
		Data: &stripe.EventData{Raw: json.RawMessage(`{invalid`)},
	})
}

func TestHandleSubscriptionUpdated_TeamNotFound(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	raw, _ := json.Marshal(map[string]any{"id": "sub_orphaned_999", "status": "canceled"})
	deps := testDeps()
	HandleSubscriptionUpdated(ctx, deps, stripe.Event{
		Type: "customer.subscription.updated",
		Data: &stripe.EventData{Raw: raw},
	})
}
