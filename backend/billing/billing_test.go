//go:build integration

package billing

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v84"
)

const testCheckoutUserEmail = "user@test.com"

// --------------------------------------------------------------------------
// GetTeamBilling
// --------------------------------------------------------------------------

func TestGetTeamBilling(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "config-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_gc"), strPtr("sub_gc"))

		cfg, err := GetTeamBilling(ctx, th.PgPool, teamID)
		if err != nil {
			t.Fatalf("GetTeamBilling: %v", err)
		}
		if cfg.Plan != "pro" {
			t.Errorf("plan = %q, want %q", cfg.Plan, "pro")
		}
		if cfg.StripeCustomerID == nil || *cfg.StripeCustomerID != "cus_gc" {
			t.Errorf("stripe_customer_id = %v, want %q", cfg.StripeCustomerID, "cus_gc")
		}
	})

	t.Run("not found", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		_, err := GetTeamBilling(ctx, th.PgPool, uuid.New())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// --------------------------------------------------------------------------
// ProcessUpgrade
// --------------------------------------------------------------------------

func TestProcessUpgrade(t *testing.T) {
	t.Run("sets pro plan and unblocks ingest", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team", false)
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		if err := ProcessUpgrade(ctx, th.PgPool, teamID.String(), "sub_new_123"); err != nil {
			t.Fatalf("ProcessUpgrade: %v", err)
		}

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "pro" {
			t.Errorf("plan = %q, want %q", bc.Plan, "pro")
		}
		if bc.StripeSubscriptionID == nil || *bc.StripeSubscriptionID != "sub_new_123" {
			t.Errorf("stripe_subscription_id = %v, want %q", bc.StripeSubscriptionID, "sub_new_123")
		}

		if !getTeamAllowIngest(ctx, t, teamID) {
			t.Error("allow_ingest should be true after upgrade")
		}
		if reason := getTeamIngestBlockedReason(ctx, t, teamID); reason != nil {
			t.Errorf("ingest_blocked_reason = %q, want nil", *reason)
		}
	})

	t.Run("preserves stripe customer id", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team", true)
		seedTeamBilling(ctx, t, teamID, "free", strPtr("cus_keep_me"), nil)

		if err := ProcessUpgrade(ctx, th.PgPool, teamID.String(), "sub_456"); err != nil {
			t.Fatalf("ProcessUpgrade: %v", err)
		}

		bc := getTeamBilling(ctx, t, teamID)
		if bc.StripeCustomerID == nil || *bc.StripeCustomerID != "cus_keep_me" {
			t.Errorf("stripe_customer_id = %v, want %q", bc.StripeCustomerID, "cus_keep_me")
		}
	})
}

// --------------------------------------------------------------------------
// DowngradeTeamBillingToFree
// --------------------------------------------------------------------------
func TestDowngradeTeamBillingToFree(t *testing.T) {
	t.Run("resets to free plan limits", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_abc"), strPtr("sub_abc"))

		if err := DowngradeTeamBillingToFree(ctx, th.PgPool, teamID); err != nil {
			t.Fatalf("DowngradeTeamBillingToFree: %v", err)
		}

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q", bc.Plan, "free")
		}
		if bc.StripeSubscriptionID != nil {
			t.Errorf("stripe_subscription_id = %v, want nil", *bc.StripeSubscriptionID)
		}
	})

	t.Run("preserves stripe customer id", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_keep"), strPtr("sub_drop"))

		if err := DowngradeTeamBillingToFree(ctx, th.PgPool, teamID); err != nil {
			t.Fatalf("DowngradeTeamBillingToFree: %v", err)
		}

		bc := getTeamBilling(ctx, t, teamID)
		if bc.StripeCustomerID == nil || *bc.StripeCustomerID != "cus_keep" {
			t.Errorf("stripe_customer_id = %v, want %q", bc.StripeCustomerID, "cus_keep")
		}
	})
}

// --------------------------------------------------------------------------
// ProcessDowngrade
// --------------------------------------------------------------------------

func TestProcessDowngrade(t *testing.T) {
	t.Run("usage under free limit allows ingest", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_abc"), strPtr("sub_abc"))
		seedApp(ctx, t, appID, teamID, 180)

		deps := testDeps()
		if err := ProcessDowngrade(ctx, deps, teamID); err != nil {
			t.Fatalf("ProcessDowngrade: %v", err)
		}

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q", bc.Plan, "free")
		}
		if r := getAppRetention(ctx, t, appID); r != FreePlanMaxRetentionDays {
			t.Errorf("app retention = %d, want %d", r, FreePlanMaxRetentionDays)
		}
		if !getTeamAllowIngest(ctx, t, teamID) {
			t.Error("allow_ingest should be true (no usage)")
		}
		if reason := getTeamIngestBlockedReason(ctx, t, teamID); reason != nil {
			t.Errorf("ingest_blocked_reason = %q, want nil", *reason)
		}
	})

	t.Run("usage over free limit blocks ingest", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New().String()
		now := time.Now().UTC()

		seedTeam(ctx, t, teamID, "test-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_abc"), strPtr("sub_abc"))
		// Seed enough usage to exceed free limit (1M)
		seedIngestionUsage(ctx, t, teamID.String(), appID, now, 500000, 500000, 100)

		deps := testDeps()
		if err := ProcessDowngrade(ctx, deps, teamID); err != nil {
			t.Fatalf("ProcessDowngrade: %v", err)
		}

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q", bc.Plan, "free")
		}
		if getTeamAllowIngest(ctx, t, teamID) {
			t.Error("allow_ingest should be false (usage over free limit)")
		}
		if reason := getTeamIngestBlockedReason(ctx, t, teamID); reason == nil || *reason != ReasonPlanLimitExceeded {
			t.Errorf("ingest_blocked_reason = %v, want %q", reason, ReasonPlanLimitExceeded)
		}
	})

	t.Run("already on free ensures consistent state", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team", true)
		seedTeamBilling(ctx, t, teamID, "free", strPtr("cus_abc"), nil)

		deps := testDeps()
		if err := ProcessDowngrade(ctx, deps, teamID); err != nil {
			t.Fatalf("ProcessDowngrade: %v", err)
		}

		bc := getTeamBilling(ctx, t, teamID)
		if bc.Plan != "free" {
			t.Errorf("plan = %q, want %q", bc.Plan, "free")
		}
	})
}

// --------------------------------------------------------------------------
// CancelAndDowngradeToFree
// --------------------------------------------------------------------------

func TestCancelAndDowngradeToFree_ConfigNotFound(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	deps := testDeps()
	teamID := uuid.New()

	err := CancelAndDowngradeToFree(ctx, deps, teamID)
	if !errors.Is(err, ErrTeamBillingNotFound) {
		t.Fatalf("expected ErrTeamBillingNotFound, got: %v", err)
	}
}

func TestCancelAndDowngradeToFree_AlreadyOnFree(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	deps := testDeps()
	teamID := uuid.New()
	seedTeamWithBilling(ctx, t, teamID.String(), "FreeTeam", "free", true)

	err := CancelAndDowngradeToFree(ctx, deps, teamID)
	if err != nil {
		t.Fatalf("expected nil, got: %v", err)
	}
}

func TestCancelAndDowngradeToFree_WithSubscription(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	deps := testDeps()
	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, "ProTeam", true)
	seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_123"), strPtr("sub_123"))
	seedApp(ctx, t, appID, teamID, MaxRetentionDays)

	var cancelCalled bool
	orig := CancelSubscriptionFn
	CancelSubscriptionFn = func(id string, params *stripe.SubscriptionCancelParams) (*stripe.Subscription, error) {
		cancelCalled = true
		if id != "sub_123" {
			t.Errorf("expected subscription ID sub_123, got %s", id)
		}
		return &stripe.Subscription{ID: id, Status: stripe.SubscriptionStatusCanceled}, nil
	}
	t.Cleanup(func() { CancelSubscriptionFn = orig })

	err := CancelAndDowngradeToFree(ctx, deps, teamID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !cancelCalled {
		t.Error("expected CancelSubscriptionFn to be called")
	}

	// Verify plan is still "pro" (webhook handles downgrade asynchronously)
	var plan string
	if err := th.PgPool.QueryRow(ctx,
		"SELECT plan FROM team_billing WHERE team_id = $1", teamID).Scan(&plan); err != nil {
		t.Fatalf("query: %v", err)
	}
	if plan != "pro" {
		t.Errorf("expected plan=pro, got %q", plan)
	}
}

func TestCancelAndDowngradeToFree_NoSubscriptionID(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	deps := testDeps()
	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "ProNoSub", true)
	seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_456"), nil)

	orig := CancelSubscriptionFn
	CancelSubscriptionFn = func(id string, params *stripe.SubscriptionCancelParams) (*stripe.Subscription, error) {
		t.Error("CancelSubscriptionFn should not be called when no subscription ID")
		return nil, nil
	}
	t.Cleanup(func() { CancelSubscriptionFn = orig })

	err := CancelAndDowngradeToFree(ctx, deps, teamID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify downgrade happened
	var plan string
	if err := th.PgPool.QueryRow(ctx,
		"SELECT plan FROM team_billing WHERE team_id = $1", teamID).Scan(&plan); err != nil {
		t.Fatalf("query: %v", err)
	}
	if plan != "free" {
		t.Errorf("expected plan=free, got %q", plan)
	}
}

func TestCancelAndDowngradeToFree_SubscriptionAlreadyCanceled(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	deps := testDeps()
	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "ProAlreadyCanceled", true)
	seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_789"), strPtr("sub_789"))

	orig := CancelSubscriptionFn
	CancelSubscriptionFn = func(id string, params *stripe.SubscriptionCancelParams) (*stripe.Subscription, error) {
		return nil, &stripe.Error{
			Code: stripe.ErrorCodeResourceMissing,
			Msg:  "No such subscription: sub_789",
		}
	}
	defer func() { CancelSubscriptionFn = orig }()

	// This should succeed by ignoring the error
	err := CancelAndDowngradeToFree(ctx, deps, teamID)
	if err != nil {
		t.Fatalf("expected success, got: %v", err)
	}

	// Verify plan is free (downgrade proceeded)
	var plan string
	if err := th.PgPool.QueryRow(ctx,
		"SELECT plan FROM team_billing WHERE team_id = $1", teamID).Scan(&plan); err != nil {
		t.Fatalf("query: %v", err)
	}
	if plan != "free" {
		t.Errorf("expected plan=free, got %q", plan)
	}
}

// --------------------------------------------------------------------------
// InitiateUpgrade
// --------------------------------------------------------------------------

func TestInitiateUpgrade_ConfigNotFound(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	_, err := InitiateUpgrade(ctx, th.PgPool, uuid.New(), testCheckoutUserEmail, "price_123", "https://ok", "https://cancel")
	if !errors.Is(err, ErrTeamBillingNotFound) {
		t.Fatalf("expected ErrTeamBillingNotFound, got: %v", err)
	}
}

func TestInitiateUpgrade_AlreadyOnPro(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "ProTeam", true)
	seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_123"), strPtr("sub_123"))

	_, err := InitiateUpgrade(ctx, th.PgPool, teamID, testCheckoutUserEmail, "price_123", "https://ok", "https://cancel")
	if !errors.Is(err, ErrAlreadyOnProPlan) {
		t.Fatalf("expected ErrAlreadyOnProPlan, got: %v", err)
	}
}

func TestInitiateUpgrade_NewCustomer(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "FreeTeam", true)
	seedTeamBilling(ctx, t, teamID, "free", nil, nil)

	origCustomer := CreateStripeCustomerFn
	CreateStripeCustomerFn = func(params *stripe.CustomerParams) (*stripe.Customer, error) {
		return &stripe.Customer{ID: "cus_new_test"}, nil
	}
	t.Cleanup(func() { CreateStripeCustomerFn = origCustomer })

	origFind := FindActiveSubscriptionFn
	FindActiveSubscriptionFn = func(customerID string) (*stripe.Subscription, error) {
		return nil, nil
	}
	t.Cleanup(func() { FindActiveSubscriptionFn = origFind })

	origCheckout := CreateStripeCheckoutSessionFn
	CreateStripeCheckoutSessionFn = func(params *stripe.CheckoutSessionParams) (*stripe.CheckoutSession, error) {
		return &stripe.CheckoutSession{URL: "https://checkout.stripe.com/test"}, nil
	}
	t.Cleanup(func() { CreateStripeCheckoutSessionFn = origCheckout })

	result, err := InitiateUpgrade(ctx, th.PgPool, teamID, testCheckoutUserEmail, "price_123", "https://ok", "https://cancel")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.AlreadyUpgraded {
		t.Error("expected AlreadyUpgraded=false")
	}
	if result.CheckoutURL != "https://checkout.stripe.com/test" {
		t.Errorf("CheckoutURL = %q, want %q", result.CheckoutURL, "https://checkout.stripe.com/test")
	}

	// Verify customer ID was saved
	cfg, err := GetTeamBilling(ctx, th.PgPool, teamID)
	if err != nil {
		t.Fatalf("GetTeamBilling: %v", err)
	}
	if cfg.StripeCustomerID == nil || *cfg.StripeCustomerID != "cus_new_test" {
		t.Errorf("stripe_customer_id = %v, want %q", cfg.StripeCustomerID, "cus_new_test")
	}
	if cfg.Plan != "free" {
		t.Errorf("plan = %q, want %q (unchanged)", cfg.Plan, "free")
	}
}

func TestInitiateUpgrade_SelfHeal(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "FreeTeam", false)
	seedTeamBilling(ctx, t, teamID, "free", strPtr("cus_existing"), nil)
	seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

	origFind := FindActiveSubscriptionFn
	FindActiveSubscriptionFn = func(customerID string) (*stripe.Subscription, error) {
		if customerID != "cus_existing" {
			t.Errorf("unexpected customerID: %s", customerID)
		}
		return &stripe.Subscription{ID: "sub_recovered"}, nil
	}
	t.Cleanup(func() { FindActiveSubscriptionFn = origFind })

	result, err := InitiateUpgrade(ctx, th.PgPool, teamID, testCheckoutUserEmail, "price_123", "https://ok", "https://cancel")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.AlreadyUpgraded {
		t.Error("expected AlreadyUpgraded=true")
	}

	// Verify upgrade happened
	cfg, err := GetTeamBilling(ctx, th.PgPool, teamID)
	if err != nil {
		t.Fatalf("GetTeamBilling: %v", err)
	}
	if cfg.Plan != "pro" {
		t.Errorf("plan = %q, want %q", cfg.Plan, "pro")
	}
	if cfg.StripeSubscriptionID == nil || *cfg.StripeSubscriptionID != "sub_recovered" {
		t.Errorf("stripe_subscription_id = %v, want %q", cfg.StripeSubscriptionID, "sub_recovered")
	}
}

func TestInitiateUpgrade_CustomerCreationFails(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "FreeTeam", true)
	seedTeamBilling(ctx, t, teamID, "free", nil, nil)

	origCustomer := CreateStripeCustomerFn
	CreateStripeCustomerFn = func(params *stripe.CustomerParams) (*stripe.Customer, error) {
		return nil, fmt.Errorf("stripe unavailable")
	}
	t.Cleanup(func() { CreateStripeCustomerFn = origCustomer })

	_, err := InitiateUpgrade(ctx, th.PgPool, teamID, testCheckoutUserEmail, "price_123", "https://ok", "https://cancel")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "failed to create Stripe customer") {
		t.Errorf("error = %q, want to contain 'failed to create Stripe customer'", err.Error())
	}
}

func TestInitiateUpgrade_EmptyPriceID(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "FreeTeam", true)
	seedTeamBilling(ctx, t, teamID, "free", strPtr("cus_123"), nil)

	origFind := FindActiveSubscriptionFn
	FindActiveSubscriptionFn = func(customerID string) (*stripe.Subscription, error) {
		return nil, nil
	}
	t.Cleanup(func() { FindActiveSubscriptionFn = origFind })

	_, err := InitiateUpgrade(ctx, th.PgPool, teamID, testCheckoutUserEmail, "", "https://ok", "https://cancel")
	if err == nil {
		t.Fatal("expected error for empty price ID")
	}
	if !strings.Contains(err.Error(), "price ID not configured") {
		t.Errorf("error = %q, want to contain 'price ID not configured'", err.Error())
	}
}

// --------------------------------------------------------------------------
// ResetTeamAppsRetention
// --------------------------------------------------------------------------

func TestResetTeamAppsRetention(t *testing.T) {
	t.Run("resets multiple apps", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		app1 := uuid.New()
		app2 := uuid.New()
		app3 := uuid.New()
		seedTeam(ctx, t, teamID, "test-team", true)
		seedApp(ctx, t, app1, teamID, 90)
		seedApp(ctx, t, app2, teamID, 180)
		seedApp(ctx, t, app3, teamID, 365)

		if err := ResetTeamAppsRetention(ctx, th.PgPool, teamID); err != nil {
			t.Fatalf("ResetTeamAppsRetention: %v", err)
		}

		for _, appID := range []uuid.UUID{app1, app2, app3} {
			if r := getAppRetention(ctx, t, appID); r != FreePlanMaxRetentionDays {
				t.Errorf("app %s retention = %d, want %d", appID.String()[:8], r, FreePlanMaxRetentionDays)
			}
		}
	})

	t.Run("does not affect other teams", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamA := uuid.New()
		teamB := uuid.New()
		appA := uuid.New()
		appB := uuid.New()
		seedTeam(ctx, t, teamA, "team-a", true)
		seedTeam(ctx, t, teamB, "team-b", true)
		seedApp(ctx, t, appA, teamA, 180)
		seedApp(ctx, t, appB, teamB, 180)

		if err := ResetTeamAppsRetention(ctx, th.PgPool, teamA); err != nil {
			t.Fatalf("ResetTeamAppsRetention: %v", err)
		}

		if r := getAppRetention(ctx, t, appA); r != FreePlanMaxRetentionDays {
			t.Errorf("team A app retention = %d, want %d", r, FreePlanMaxRetentionDays)
		}
		if r := getAppRetention(ctx, t, appB); r != 180 {
			t.Errorf("team B app retention = %d, want %d (should be unchanged)", r, 180)
		}
	})

	t.Run("no apps is a no-op", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team", true)

		if err := ResetTeamAppsRetention(ctx, th.PgPool, teamID); err != nil {
			t.Fatalf("ResetTeamAppsRetention: %v", err)
		}
	})
}

// --------------------------------------------------------------------------
// GetTeamBySubscriptionID
// --------------------------------------------------------------------------

func TestGetTeamBySubscriptionID(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_find_me"))

		got, err := GetTeamBySubscriptionID(ctx, th.PgPool, "sub_find_me")
		if err != nil {
			t.Fatalf("GetTeamBySubscriptionID: %v", err)
		}
		if got != teamID {
			t.Errorf("team_id = %s, want %s", got, teamID)
		}
	})

	t.Run("not found", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		_, err := GetTeamBySubscriptionID(ctx, th.PgPool, "sub_nonexistent")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// --------------------------------------------------------------------------
// IsIngestAllowed
// --------------------------------------------------------------------------

func TestIsIngestAllowed(t *testing.T) {
	t.Run("ingest allowed", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "allowed-team", true)
		seedApp(ctx, t, appID, teamID, 30)

		if err := IsIngestAllowed(ctx, th.PgPool, th.VK, appID); err != nil {
			t.Errorf("expected nil, got %v", err)
		}
	})

	t.Run("ingest blocked", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "blocked-team", true)
		seedApp(ctx, t, appID, teamID, 30)
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

		err := IsIngestAllowed(ctx, th.PgPool, th.VK, appID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if got := err.Error(); got != "ingestion blocked: usage exceeded" {
			t.Errorf("error = %q, want %q", got, "ingestion blocked: usage exceeded")
		}
	})

	t.Run("cache hit allowed", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "cache-allowed-team", true)
		seedApp(ctx, t, appID, teamID, 30)

		// First call populates cache.
		if err := IsIngestAllowed(ctx, th.PgPool, th.VK, appID); err != nil {
			t.Fatalf("first call: %v", err)
		}

		// Verify key exists in Redis.
		key := ingestCacheKey(appID)
		val, err := th.VK.Do(ctx, th.VK.B().Get().Key(key).Build()).ToString()
		if err != nil {
			t.Fatalf("cache GET: %v", err)
		}
		if val != ingestCacheAllowed {
			t.Errorf("cached value = %q, want %q", val, ingestCacheAllowed)
		}

		// Second call should succeed from cache (even if we block in DB).
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")
		if err := IsIngestAllowed(ctx, th.PgPool, th.VK, appID); err != nil {
			t.Errorf("cached call should allow, got: %v", err)
		}
	})

	t.Run("cache hit blocked", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "cache-blocked-team", true)
		seedApp(ctx, t, appID, teamID, 30)
		seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

		// First call populates cache with blocked status.
		err := IsIngestAllowed(ctx, th.PgPool, th.VK, appID)
		if err == nil {
			t.Fatal("first call: expected error, got nil")
		}

		// Verify cached value is the block reason.
		key := ingestCacheKey(appID)
		val, err := th.VK.Do(ctx, th.VK.B().Get().Key(key).Build()).ToString()
		if err != nil {
			t.Fatalf("cache GET: %v", err)
		}
		if val != "usage exceeded" {
			t.Errorf("cached value = %q, want %q", val, "usage exceeded")
		}
	})

	t.Run("nil valkey client", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "nil-vk-team", true)
		seedApp(ctx, t, appID, teamID, 30)

		if err := IsIngestAllowed(ctx, th.PgPool, nil, appID); err != nil {
			t.Errorf("expected nil, got %v", err)
		}
	})

	t.Run("app not found", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		err := IsIngestAllowed(ctx, th.PgPool, th.VK, uuid.New())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// --------------------------------------------------------------------------
// IsRetentionChangeAllowed
// --------------------------------------------------------------------------

func TestIsRetentionChangeAllowed(t *testing.T) {
	t.Run("pro plan", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_pro"))

		allowed, err := IsRetentionChangeAllowed(ctx, th.PgPool, teamID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !allowed {
			t.Error("expected allowed=true for pro plan")
		}
	})

	t.Run("free plan", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "free-team", true)
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		allowed, err := IsRetentionChangeAllowed(ctx, th.PgPool, teamID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if allowed {
			t.Error("expected allowed=false for free plan")
		}
	})

	t.Run("no billing config", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "no-config-team", true)

		_, err := IsRetentionChangeAllowed(ctx, th.PgPool, teamID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// --------------------------------------------------------------------------
// GetUsageThreshold
// --------------------------------------------------------------------------

func TestGetUsageThreshold(t *testing.T) {
	t.Run("team not found", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		_, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, uuid.New())
		if err == nil {
			t.Fatal("expected error for missing team, got nil")
		}
	})

	t.Run("pro plan returns 0", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeamWithBilling(ctx, t, teamID.String(), "pro-team", "pro", true)
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 1_200_000)

		threshold, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, teamID)
		if err != nil {
			t.Fatalf("GetUsageThreshold: %v", err)
		}
		if threshold != 0 {
			t.Errorf("threshold = %d, want 0 for pro plan", threshold)
		}
	})

	t.Run("free plan no usage returns 0", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeamWithBilling(ctx, t, teamID.String(), "free-team", "free", true)

		threshold, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, teamID)
		if err != nil {
			t.Fatalf("GetUsageThreshold: %v", err)
		}
		if threshold != 0 {
			t.Errorf("threshold = %d, want 0", threshold)
		}
	})

	t.Run("free plan 74% usage returns 0", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeamWithBilling(ctx, t, teamID.String(), "free-team", "free", true)
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 740_000)

		threshold, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, teamID)
		if err != nil {
			t.Fatalf("GetUsageThreshold: %v", err)
		}
		if threshold != 0 {
			t.Errorf("threshold = %d, want 0", threshold)
		}
	})

	t.Run("free plan exactly 75% returns 75", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeamWithBilling(ctx, t, teamID.String(), "free-team", "free", true)
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 750_000)

		threshold, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, teamID)
		if err != nil {
			t.Fatalf("GetUsageThreshold: %v", err)
		}
		if threshold != 75 {
			t.Errorf("threshold = %d, want 75", threshold)
		}
	})

	t.Run("free plan 85% usage returns 75", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeamWithBilling(ctx, t, teamID.String(), "free-team", "free", true)
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 850_000)

		threshold, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, teamID)
		if err != nil {
			t.Fatalf("GetUsageThreshold: %v", err)
		}
		if threshold != 75 {
			t.Errorf("threshold = %d, want 75", threshold)
		}
	})

	t.Run("free plan exactly 90% returns 90", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeamWithBilling(ctx, t, teamID.String(), "free-team", "free", true)
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 900_000)

		threshold, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, teamID)
		if err != nil {
			t.Fatalf("GetUsageThreshold: %v", err)
		}
		if threshold != 90 {
			t.Errorf("threshold = %d, want 90", threshold)
		}
	})

	t.Run("free plan 95% usage returns 90", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeamWithBilling(ctx, t, teamID.String(), "free-team", "free", true)
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 950_000)

		threshold, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, teamID)
		if err != nil {
			t.Fatalf("GetUsageThreshold: %v", err)
		}
		if threshold != 90 {
			t.Errorf("threshold = %d, want 90", threshold)
		}
	})

	t.Run("free plan exactly 100% returns 100", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeamWithBilling(ctx, t, teamID.String(), "free-team", "free", true)
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 1_000_000)

		threshold, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, teamID)
		if err != nil {
			t.Fatalf("GetUsageThreshold: %v", err)
		}
		if threshold != 100 {
			t.Errorf("threshold = %d, want 100", threshold)
		}
	})

	t.Run("free plan 120% usage returns 100", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeamWithBilling(ctx, t, teamID.String(), "free-team", "free", true)
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 1_200_000)

		threshold, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, teamID)
		if err != nil {
			t.Fatalf("GetUsageThreshold: %v", err)
		}
		if threshold != 100 {
			t.Errorf("threshold = %d, want 100", threshold)
		}
	})
}
