//go:build integration

package billing

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v84"
)

// --------------------------------------------------------------------------
// GetSubscriptionInfo
// --------------------------------------------------------------------------

func TestGetSubscriptionInfo(t *testing.T) {
	t.Run("team not found", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		_, err := GetSubscriptionInfo(ctx, th.PgPool, uuid.New(), "")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, ErrTeamBillingNotFound) {
			t.Errorf("want ErrTeamBillingNotFound, got %v", err)
		}
	})

	t.Run("free plan", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "free-team", true)
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		_, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, ErrNotOnProPlan) {
			t.Errorf("want ErrNotOnProPlan, got %v", err)
		}
	})

	t.Run("pro plan but no subscription id", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test"), nil)

		_, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, ErrNotOnProPlan) {
			t.Errorf("want ErrNotOnProPlan, got %v", err)
		}
	})

	t.Run("stripe subscription error", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test"), strPtr("sub_test"))

		origSub := GetStripeSubscriptionFn
		GetStripeSubscriptionFn = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			return nil, errors.New("stripe error")
		}
		t.Cleanup(func() { GetStripeSubscriptionFn = origSub })

		_, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("invoice preview error returns nil upcoming invoice", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test"), strPtr("sub_test"))

		origSub := GetStripeSubscriptionFn
		GetStripeSubscriptionFn = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			return &stripe.Subscription{
				ID:     "sub_test",
				Status: stripe.SubscriptionStatusActive,
				Items: &stripe.SubscriptionItemList{
					Data: []*stripe.SubscriptionItem{
						{CurrentPeriodStart: 1700000000, CurrentPeriodEnd: 1702678400},
					},
				},
			}, nil
		}
		t.Cleanup(func() { GetStripeSubscriptionFn = origSub })

		origInv := CreateInvoicePreviewFn
		CreateInvoicePreviewFn = func(params *stripe.InvoiceCreatePreviewParams) (*stripe.Invoice, error) {
			return nil, errors.New("invoice preview error")
		}
		t.Cleanup(func() { CreateInvoicePreviewFn = origInv })

		info, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if info.Status != string(stripe.SubscriptionStatusActive) {
			t.Errorf("status = %q, want %q", info.Status, stripe.SubscriptionStatusActive)
		}
		if info.UpcomingInvoice != nil {
			t.Error("expected UpcomingInvoice to be nil when preview fails")
		}
	})

	t.Run("success", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test"), strPtr("sub_test"))

		origSub := GetStripeSubscriptionFn
		GetStripeSubscriptionFn = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			return &stripe.Subscription{
				ID:     "sub_test",
				Status: stripe.SubscriptionStatusActive,
				Items: &stripe.SubscriptionItemList{
					Data: []*stripe.SubscriptionItem{
						{CurrentPeriodStart: 1700000000, CurrentPeriodEnd: 1702678400},
					},
				},
			}, nil
		}
		t.Cleanup(func() { GetStripeSubscriptionFn = origSub })

		origInv := CreateInvoicePreviewFn
		CreateInvoicePreviewFn = func(params *stripe.InvoiceCreatePreviewParams) (*stripe.Invoice, error) {
			return &stripe.Invoice{
				AmountDue: 5000,
				Currency:  stripe.CurrencyUSD,
			}, nil
		}
		t.Cleanup(func() { CreateInvoicePreviewFn = origInv })

		info, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "")
		if err != nil {
			t.Fatalf("GetSubscriptionInfo: %v", err)
		}
		if info.Status != string(stripe.SubscriptionStatusActive) {
			t.Errorf("status = %q, want %q", info.Status, stripe.SubscriptionStatusActive)
		}
		if info.CurrentPeriodStart != 1700000000 {
			t.Errorf("current_period_start = %d, want 1700000000", info.CurrentPeriodStart)
		}
		if info.CurrentPeriodEnd != 1702678400 {
			t.Errorf("current_period_end = %d, want 1702678400", info.CurrentPeriodEnd)
		}
		if info.UpcomingInvoice == nil {
			t.Fatal("expected UpcomingInvoice to be non-nil")
		}
		if info.UpcomingInvoice.AmountDue != 5000 {
			t.Errorf("amount_due = %d, want 5000", info.UpcomingInvoice.AmountDue)
		}
		if info.UpcomingInvoice.Currency != string(stripe.CurrencyUSD) {
			t.Errorf("currency = %q, want %q", info.UpcomingInvoice.Currency, stripe.CurrencyUSD)
		}
	})

	t.Run("billing cycle usage from meter", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_meter"), strPtr("sub_meter"))

		origSub := GetStripeSubscriptionFn
		GetStripeSubscriptionFn = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			return &stripe.Subscription{
				ID:     "sub_meter",
				Status: stripe.SubscriptionStatusActive,
				Items: &stripe.SubscriptionItemList{
					Data: []*stripe.SubscriptionItem{
						{CurrentPeriodStart: 1700000000, CurrentPeriodEnd: 1702678400},
					},
				},
			}, nil
		}
		t.Cleanup(func() { GetStripeSubscriptionFn = origSub })

		origInv := CreateInvoicePreviewFn
		CreateInvoicePreviewFn = func(params *stripe.InvoiceCreatePreviewParams) (*stripe.Invoice, error) {
			return &stripe.Invoice{AmountDue: 5000, Currency: stripe.CurrencyUSD}, nil
		}
		t.Cleanup(func() { CreateInvoicePreviewFn = origInv })

		origMeterID := FindMeterIDFn
		FindMeterIDFn = func(meterName string) (string, error) {
			if meterName != "test_meter" {
				t.Errorf("FindMeterIDFn called with %q, want %q", meterName, "test_meter")
			}
			return "mtr_123", nil
		}
		t.Cleanup(func() { FindMeterIDFn = origMeterID })

		origUsage := GetMeterUsageFn
		GetMeterUsageFn = func(meterID, customerID string, start, end int64) (float64, error) {
			if meterID != "mtr_123" {
				t.Errorf("meterID = %q, want %q", meterID, "mtr_123")
			}
			if customerID != "cus_meter" {
				t.Errorf("customerID = %q, want %q", customerID, "cus_meter")
			}
			if start != 1700000000 {
				t.Errorf("start = %d, want 1700000000", start)
			}
			if end != 1702678400 {
				t.Errorf("end = %d, want 1702678400", end)
			}
			return 15000000, nil
		}
		t.Cleanup(func() { GetMeterUsageFn = origUsage })

		info, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "test_meter")
		if err != nil {
			t.Fatalf("GetSubscriptionInfo: %v", err)
		}
		if info.BillingCycleUsage != 15000000 {
			t.Errorf("billing_cycle_usage = %f, want 15000000", info.BillingCycleUsage)
		}
	})

	t.Run("meter lookup error returns zero usage", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test"), strPtr("sub_test"))

		origSub := GetStripeSubscriptionFn
		GetStripeSubscriptionFn = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			return &stripe.Subscription{
				ID:     "sub_test",
				Status: stripe.SubscriptionStatusActive,
				Items: &stripe.SubscriptionItemList{
					Data: []*stripe.SubscriptionItem{
						{CurrentPeriodStart: 1700000000, CurrentPeriodEnd: 1702678400},
					},
				},
			}, nil
		}
		t.Cleanup(func() { GetStripeSubscriptionFn = origSub })

		origInv := CreateInvoicePreviewFn
		CreateInvoicePreviewFn = func(params *stripe.InvoiceCreatePreviewParams) (*stripe.Invoice, error) {
			return &stripe.Invoice{AmountDue: 5000, Currency: stripe.CurrencyUSD}, nil
		}
		t.Cleanup(func() { CreateInvoicePreviewFn = origInv })

		origMeterID := FindMeterIDFn
		FindMeterIDFn = func(meterName string) (string, error) {
			return "", fmt.Errorf("meter not found")
		}
		t.Cleanup(func() { FindMeterIDFn = origMeterID })

		info, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "test_meter")
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if info.BillingCycleUsage != 0 {
			t.Errorf("billing_cycle_usage = %f, want 0", info.BillingCycleUsage)
		}
	})

	t.Run("meter usage error returns zero usage", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test"), strPtr("sub_test"))

		origSub := GetStripeSubscriptionFn
		GetStripeSubscriptionFn = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			return &stripe.Subscription{
				ID:     "sub_test",
				Status: stripe.SubscriptionStatusActive,
				Items: &stripe.SubscriptionItemList{
					Data: []*stripe.SubscriptionItem{
						{CurrentPeriodStart: 1700000000, CurrentPeriodEnd: 1702678400},
					},
				},
			}, nil
		}
		t.Cleanup(func() { GetStripeSubscriptionFn = origSub })

		origInv := CreateInvoicePreviewFn
		CreateInvoicePreviewFn = func(params *stripe.InvoiceCreatePreviewParams) (*stripe.Invoice, error) {
			return &stripe.Invoice{AmountDue: 5000, Currency: stripe.CurrencyUSD}, nil
		}
		t.Cleanup(func() { CreateInvoicePreviewFn = origInv })

		origMeterID := FindMeterIDFn
		FindMeterIDFn = func(meterName string) (string, error) {
			return "mtr_123", nil
		}
		t.Cleanup(func() { FindMeterIDFn = origMeterID })

		origUsage := GetMeterUsageFn
		GetMeterUsageFn = func(meterID, customerID string, start, end int64) (float64, error) {
			return 0, fmt.Errorf("stripe API error")
		}
		t.Cleanup(func() { GetMeterUsageFn = origUsage })

		info, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "test_meter")
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if info.BillingCycleUsage != 0 {
			t.Errorf("billing_cycle_usage = %f, want 0", info.BillingCycleUsage)
		}
	})

	t.Run("empty meter name skips usage lookup", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test"), strPtr("sub_test"))

		origSub := GetStripeSubscriptionFn
		GetStripeSubscriptionFn = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			return &stripe.Subscription{
				ID:     "sub_test",
				Status: stripe.SubscriptionStatusActive,
				Items: &stripe.SubscriptionItemList{
					Data: []*stripe.SubscriptionItem{
						{CurrentPeriodStart: 1700000000, CurrentPeriodEnd: 1702678400},
					},
				},
			}, nil
		}
		t.Cleanup(func() { GetStripeSubscriptionFn = origSub })

		origInv := CreateInvoicePreviewFn
		CreateInvoicePreviewFn = func(params *stripe.InvoiceCreatePreviewParams) (*stripe.Invoice, error) {
			return &stripe.Invoice{AmountDue: 5000, Currency: stripe.CurrencyUSD}, nil
		}
		t.Cleanup(func() { CreateInvoicePreviewFn = origInv })

		meterCalled := false
		origMeterID := FindMeterIDFn
		FindMeterIDFn = func(meterName string) (string, error) {
			meterCalled = true
			return "", nil
		}
		t.Cleanup(func() { FindMeterIDFn = origMeterID })

		info, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "")
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if meterCalled {
			t.Error("FindMeterIDFn should not be called when meterName is empty")
		}
		if info.BillingCycleUsage != 0 {
			t.Errorf("billing_cycle_usage = %f, want 0", info.BillingCycleUsage)
		}
	})

	t.Run("multiple meter summaries are summed", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test"), strPtr("sub_test"))

		origSub := GetStripeSubscriptionFn
		GetStripeSubscriptionFn = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			return &stripe.Subscription{
				ID:     "sub_test",
				Status: stripe.SubscriptionStatusActive,
				Items: &stripe.SubscriptionItemList{
					Data: []*stripe.SubscriptionItem{
						{CurrentPeriodStart: 1700000000, CurrentPeriodEnd: 1702678400},
					},
				},
			}, nil
		}
		t.Cleanup(func() { GetStripeSubscriptionFn = origSub })

		origInv := CreateInvoicePreviewFn
		CreateInvoicePreviewFn = func(params *stripe.InvoiceCreatePreviewParams) (*stripe.Invoice, error) {
			return &stripe.Invoice{AmountDue: 5000, Currency: stripe.CurrencyUSD}, nil
		}
		t.Cleanup(func() { CreateInvoicePreviewFn = origInv })

		origMeterID := FindMeterIDFn
		FindMeterIDFn = func(meterName string) (string, error) {
			return "mtr_123", nil
		}
		t.Cleanup(func() { FindMeterIDFn = origMeterID })

		origUsage := GetMeterUsageFn
		GetMeterUsageFn = func(meterID, customerID string, start, end int64) (float64, error) {
			// Simulate summed result from multiple summaries
			return 10000000 + 5000000 + 3000000, nil
		}
		t.Cleanup(func() { GetMeterUsageFn = origUsage })

		info, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "test_meter")
		if err != nil {
			t.Fatalf("GetSubscriptionInfo: %v", err)
		}
		if info.BillingCycleUsage != 18000000 {
			t.Errorf("billing_cycle_usage = %f, want 18000000", info.BillingCycleUsage)
		}
	})
}

func TestGetSubscriptionInfo_NoSubscriptionItems(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "pro-team", true)
	seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test"), strPtr("sub_test"))

	origSub := GetStripeSubscriptionFn
	GetStripeSubscriptionFn = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
		return &stripe.Subscription{
			ID:     "sub_test",
			Status: stripe.SubscriptionStatusActive,
			Items:  &stripe.SubscriptionItemList{Data: []*stripe.SubscriptionItem{}},
		}, nil
	}
	t.Cleanup(func() { GetStripeSubscriptionFn = origSub })

	origInv := CreateInvoicePreviewFn
	CreateInvoicePreviewFn = func(params *stripe.InvoiceCreatePreviewParams) (*stripe.Invoice, error) {
		return &stripe.Invoice{AmountDue: 1000, Currency: stripe.CurrencyUSD}, nil
	}
	t.Cleanup(func() { CreateInvoicePreviewFn = origInv })

	info, err := GetSubscriptionInfo(ctx, th.PgPool, teamID, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Status != string(stripe.SubscriptionStatusActive) {
		t.Errorf("status = %q, want %q", info.Status, stripe.SubscriptionStatusActive)
	}
	if info.CurrentPeriodStart != 0 {
		t.Errorf("current_period_start = %d, want 0", info.CurrentPeriodStart)
	}
	if info.CurrentPeriodEnd != 0 {
		t.Errorf("current_period_end = %d, want 0", info.CurrentPeriodEnd)
	}
}

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
		// Seed enough usage to exceed free limit (5 GB)
		seedIngestionUsage(ctx, t, teamID.String(), appID, now, 500000, 500000, 100, uint64(FreePlanMaxBytes)+1000)

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

func TestProcessDowngrade_ClickHouseFailure_FailsOpen(t *testing.T) {
	ctx := context.Background()
	defer cleanupAll(ctx, t)

	teamID := uuid.New()
	appID := uuid.New()
	seedTeam(ctx, t, teamID, "test-team", true)
	seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_abc"), strPtr("sub_abc"))
	seedApp(ctx, t, appID, teamID, 180)

	// Create a closed ClickHouse connection so queries fail.
	brokenConn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{"127.0.0.1:1"},
	})
	if err != nil {
		t.Fatalf("clickhouse.Open: %v", err)
	}
	brokenConn.Close()

	deps := testDeps()
	deps.ChPool = brokenConn

	if err := ProcessDowngrade(ctx, deps, teamID); err != nil {
		t.Fatalf("ProcessDowngrade should not return error on CH failure (fail-open): %v", err)
	}

	// Verify billing was downgraded
	bc := getTeamBilling(ctx, t, teamID)
	if bc.Plan != "free" {
		t.Errorf("plan = %q, want %q", bc.Plan, "free")
	}

	// Verify ingest is allowed (fail-open)
	if !getTeamAllowIngest(ctx, t, teamID) {
		t.Error("allow_ingest should be true (fail-open on CH error)")
	}
	if reason := getTeamIngestBlockedReason(ctx, t, teamID); reason != nil {
		t.Errorf("ingest_blocked_reason = %q, want nil (fail-open)", *reason)
	}

	// Verify retention was still reset
	if r := getAppRetention(ctx, t, appID); r != FreePlanMaxRetentionDays {
		t.Errorf("app retention = %d, want %d", r, FreePlanMaxRetentionDays)
	}
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

func TestCancelAndDowngradeToFree_GenericStripeError(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	deps := testDeps()
	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "ProTeam", true)
	seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_123"), strPtr("sub_123"))

	orig := CancelSubscriptionFn
	CancelSubscriptionFn = func(id string, params *stripe.SubscriptionCancelParams) (*stripe.Subscription, error) {
		return nil, &stripe.Error{
			Code: stripe.ErrorCodeCardDeclined,
			Msg:  "generic stripe failure",
		}
	}
	t.Cleanup(func() { CancelSubscriptionFn = orig })

	err := CancelAndDowngradeToFree(ctx, deps, teamID)
	if err == nil {
		t.Fatal("expected error for non-resource-missing Stripe error")
	}
	if !strings.Contains(err.Error(), "failed to cancel stripe subscription") {
		t.Errorf("error = %q, want to contain 'failed to cancel stripe subscription'", err.Error())
	}

	// Verify team remains on pro (cancel failed, state unchanged)
	bc := getTeamBilling(ctx, t, teamID)
	if bc.Plan != "pro" {
		t.Errorf("plan = %q, want %q (should remain pro after cancel failure)", bc.Plan, "pro")
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

func TestInitiateUpgrade_SelfHeal_TrialingSub(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "FreeTeam", false)
	seedTeamBilling(ctx, t, teamID, "free", strPtr("cus_existing"), nil)
	seedTeamIngestBlocked(ctx, t, teamID, "usage exceeded")

	origFind := FindActiveSubscriptionFn
	FindActiveSubscriptionFn = func(customerID string) (*stripe.Subscription, error) {
		return &stripe.Subscription{ID: "sub_trialing", Status: stripe.SubscriptionStatusTrialing}, nil
	}
	t.Cleanup(func() { FindActiveSubscriptionFn = origFind })

	result, err := InitiateUpgrade(ctx, th.PgPool, teamID, testCheckoutUserEmail, "price_123", "https://ok", "https://cancel")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.AlreadyUpgraded {
		t.Error("expected AlreadyUpgraded=true for trialing subscription")
	}

	cfg, err := GetTeamBilling(ctx, th.PgPool, teamID)
	if err != nil {
		t.Fatalf("GetTeamBilling: %v", err)
	}
	if cfg.Plan != "pro" {
		t.Errorf("plan = %q, want %q", cfg.Plan, "pro")
	}
	if cfg.StripeSubscriptionID == nil || *cfg.StripeSubscriptionID != "sub_trialing" {
		t.Errorf("stripe_subscription_id = %v, want %q", cfg.StripeSubscriptionID, "sub_trialing")
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

func TestInitiateUpgrade_FindActiveSubscriptionFails(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "FreeTeam", true)
	seedTeamBilling(ctx, t, teamID, "free", strPtr("cus_existing"), nil)

	origFind := FindActiveSubscriptionFn
	FindActiveSubscriptionFn = func(customerID string) (*stripe.Subscription, error) {
		return nil, fmt.Errorf("stripe list subscriptions failed")
	}
	t.Cleanup(func() { FindActiveSubscriptionFn = origFind })

	_, err := InitiateUpgrade(ctx, th.PgPool, teamID, testCheckoutUserEmail, "price_123", "https://ok", "https://cancel")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "failed to check existing subscriptions") {
		t.Errorf("error = %q, want to contain 'failed to check existing subscriptions'", err.Error())
	}

	// Verify team not modified
	bc := getTeamBilling(ctx, t, teamID)
	if bc.Plan != "free" {
		t.Errorf("plan = %q, want %q (unchanged)", bc.Plan, "free")
	}
}

func TestInitiateUpgrade_CheckoutSessionCreationFails(t *testing.T) {
	ctx := context.Background()
	t.Cleanup(func() { cleanupAll(ctx, t) })

	teamID := uuid.New()
	seedTeam(ctx, t, teamID, "FreeTeam", true)
	seedTeamBilling(ctx, t, teamID, "free", strPtr("cus_existing"), nil)

	origFind := FindActiveSubscriptionFn
	FindActiveSubscriptionFn = func(customerID string) (*stripe.Subscription, error) {
		return nil, nil
	}
	t.Cleanup(func() { FindActiveSubscriptionFn = origFind })

	origCheckout := CreateStripeCheckoutSessionFn
	CreateStripeCheckoutSessionFn = func(params *stripe.CheckoutSessionParams) (*stripe.CheckoutSession, error) {
		return nil, fmt.Errorf("stripe checkout unavailable")
	}
	t.Cleanup(func() { CreateStripeCheckoutSessionFn = origCheckout })

	_, err := InitiateUpgrade(ctx, th.PgPool, teamID, testCheckoutUserEmail, "price_123", "https://ok", "https://cancel")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "failed to create checkout session") {
		t.Errorf("error = %q, want to contain 'failed to create checkout session'", err.Error())
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

	t.Run("advances data_cutoff_date on downgrade", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		appID := uuid.New()
		seedTeam(ctx, t, teamID, "test-team", true)
		seedApp(ctx, t, appID, teamID, 90)

		// Set cutoff to 90 days ago (simulating active 90-day retention)
		today := time.Now().UTC().Truncate(24 * time.Hour)
		oldCutoff := today.AddDate(0, 0, -90)
		setAppDataCutoffDate(ctx, t, appID, oldCutoff)

		if err := ResetTeamAppsRetention(ctx, th.PgPool, teamID); err != nil {
			t.Fatalf("ResetTeamAppsRetention: %v", err)
		}

		// Cutoff should jump forward to today - 30 (free plan retention)
		got := getAppDataCutoffDate(ctx, t, appID)
		expected := today.AddDate(0, 0, -FreePlanMaxRetentionDays)
		if !got.Equal(expected) {
			t.Errorf("data_cutoff_date = %v, want %v", got.Format("2006-01-02"), expected.Format("2006-01-02"))
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
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 6_442_450_944)

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
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 3_972_844_748)

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
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 4_026_531_840)

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
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 4_563_402_752)

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
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 4_831_838_208)

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
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 5_100_273_664)

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
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 5_368_709_120)

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
		seedCurrentMonthIngestionUsage(ctx, t, teamID.String(), 6_442_450_944)

		threshold, err := GetUsageThreshold(ctx, th.PgPool, th.ChConn, teamID)
		if err != nil {
			t.Fatalf("GetUsageThreshold: %v", err)
		}
		if threshold != 100 {
			t.Errorf("threshold = %d, want 100", threshold)
		}
	})
}

// --------------------------------------------------------------------------
// CreateCustomerPortalSession
// --------------------------------------------------------------------------

func TestCreateCustomerPortalSession(t *testing.T) {
	t.Run("team not found", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		_, err := CreateCustomerPortalSession(ctx, th.PgPool, uuid.New(), "https://example.com/usage")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, ErrTeamBillingNotFound) {
			t.Errorf("want ErrTeamBillingNotFound, got %v", err)
		}
	})

	t.Run("free plan", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "free-team", true)
		seedTeamBilling(ctx, t, teamID, "free", nil, nil)

		_, err := CreateCustomerPortalSession(ctx, th.PgPool, teamID, "https://example.com/usage")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, ErrNotOnProPlan) {
			t.Errorf("want ErrNotOnProPlan, got %v", err)
		}
	})

	t.Run("pro plan but no stripe customer id", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", nil, strPtr("sub_test"))

		_, err := CreateCustomerPortalSession(ctx, th.PgPool, teamID, "https://example.com/usage")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !errors.Is(err, ErrNoStripeCustomer) {
			t.Errorf("want ErrNoStripeCustomer, got %v", err)
		}
	})

	t.Run("stripe portal session error", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test"), strPtr("sub_test"))

		orig := CreateBillingPortalSessionFn
		CreateBillingPortalSessionFn = func(params *stripe.BillingPortalSessionParams) (*stripe.BillingPortalSession, error) {
			return nil, errors.New("stripe unavailable")
		}
		t.Cleanup(func() { CreateBillingPortalSessionFn = orig })

		_, err := CreateCustomerPortalSession(ctx, th.PgPool, teamID, "https://example.com/usage")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !strings.Contains(err.Error(), "failed to create billing portal session") {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("success", func(t *testing.T) {
		ctx := context.Background()
		defer cleanupAll(ctx, t)

		teamID := uuid.New()
		seedTeam(ctx, t, teamID, "pro-team", true)
		seedTeamBilling(ctx, t, teamID, "pro", strPtr("cus_test_123"), strPtr("sub_test"))

		const wantURL = "https://billing.stripe.com/session/test_abc"
		orig := CreateBillingPortalSessionFn
		CreateBillingPortalSessionFn = func(params *stripe.BillingPortalSessionParams) (*stripe.BillingPortalSession, error) {
			if *params.Customer != "cus_test_123" {
				t.Errorf("customer = %q, want %q", *params.Customer, "cus_test_123")
			}
			if *params.ReturnURL != "https://example.com/usage" {
				t.Errorf("return_url = %q, want %q", *params.ReturnURL, "https://example.com/usage")
			}
			return &stripe.BillingPortalSession{URL: wantURL}, nil
		}
		t.Cleanup(func() { CreateBillingPortalSessionFn = orig })

		url, err := CreateCustomerPortalSession(ctx, th.PgPool, teamID, "https://example.com/usage")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if url != wantURL {
			t.Errorf("url = %q, want %q", url, wantURL)
		}
	})
}

