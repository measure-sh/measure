//go:build functional

package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v84"
	"github.com/stripe/stripe-go/v84/billing/meter"
	"github.com/stripe/stripe-go/v84/billing/meterevent"
	"github.com/stripe/stripe-go/v84/billing/metereventsummary"
	"github.com/stripe/stripe-go/v84/customer"
	"github.com/stripe/stripe-go/v84/invoice"
	"github.com/stripe/stripe-go/v84/paymentmethod"
	"github.com/stripe/stripe-go/v84/price"
	"github.com/stripe/stripe-go/v84/subscription"
	"github.com/stripe/stripe-go/v84/testhelpers/testclock"
)

// ---------------------------------------------------------------------------
// Helper: poll test clock until ready
// ---------------------------------------------------------------------------

func waitForTestClockReady(t *testing.T, clockID string, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		tc, err := testclock.Get(clockID, nil)
		if err != nil {
			t.Fatalf("failed to get test clock: %v", err)
		}
		switch tc.Status {
		case stripe.TestHelpersTestClockStatusReady:
			return
		case stripe.TestHelpersTestClockStatusInternalFailure:
			t.Fatalf("test clock %s entered internal_failure state", clockID)
		}
		time.Sleep(5 * time.Second)
	}
	t.Fatalf("test clock %s did not become ready within %v", clockID, timeout)
}

// ---------------------------------------------------------------------------
// Helper: tiered pricing calculation (supports both volume and graduated.
// We only use volume, but this is reusable if we want to test graduated
// pricing in the future)
// ---------------------------------------------------------------------------

func calculateTieredAmount(totalUnits int64, tiers []*stripe.PriceTier, mode stripe.PriceTiersMode) int64 {
	switch mode {
	case stripe.PriceTiersModeVolume:
		return calculateVolumeTieredAmount(totalUnits, tiers)
	case stripe.PriceTiersModeGraduated:
		return calculateGraduatedTieredAmount(totalUnits, tiers)
	default:
		panic(fmt.Sprintf("unsupported tiers_mode: %s", mode))
	}
}

func calculateVolumeTieredAmount(totalUnits int64, tiers []*stripe.PriceTier) int64 {
	for _, tier := range tiers {
		if tier.UpTo == 0 || totalUnits <= tier.UpTo {
			amount := tier.FlatAmount
			if tier.UnitAmountDecimal > 0 {
				amount += int64(math.Round(tier.UnitAmountDecimal * float64(totalUnits)))
			} else {
				amount += tier.UnitAmount * totalUnits
			}
			return amount
		}
	}
	return 0
}

func calculateGraduatedTieredAmount(totalUnits int64, tiers []*stripe.PriceTier) int64 {
	var amount, previousUpTo int64
	for _, tier := range tiers {
		var unitsInTier int64
		if tier.UpTo == 0 {
			unitsInTier = totalUnits - previousUpTo
		} else {
			upTo := tier.UpTo
			if totalUnits < upTo {
				upTo = totalUnits
			}
			unitsInTier = upTo - previousUpTo
		}
		if unitsInTier <= 0 {
			break
		}
		if tier.UnitAmountDecimal > 0 {
			amount += int64(math.Round(tier.UnitAmountDecimal * float64(unitsInTier)))
		} else {
			amount += unitsInTier * tier.UnitAmount
		}
		if tier.FlatAmount > 0 {
			amount += tier.FlatAmount
		}
		if tier.UpTo == 0 {
			break
		}
		previousUpTo = tier.UpTo
		if totalUnits <= tier.UpTo {
			break
		}
	}
	return amount
}

// ---------------------------------------------------------------------------
// Helper: find meter ID by event name
// ---------------------------------------------------------------------------

func findMeterID(t *testing.T, eventName string) string {
	t.Helper()
	iter := meter.List(&stripe.BillingMeterListParams{})
	for iter.Next() {
		m := iter.BillingMeter()
		if m.EventName == eventName {
			return m.ID
		}
	}
	if err := iter.Err(); err != nil {
		t.Fatalf("list meters: %v", err)
	}
	t.Fatalf("meter with event_name=%q not found", eventName)
	return ""
}

// ---------------------------------------------------------------------------
// Helper: wait for meter event aggregation to complete
// ---------------------------------------------------------------------------

func waitForMeterAggregation(t *testing.T, meterID, customerID string, start, end time.Time, expectedTotal float64, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		params := &stripe.BillingMeterEventSummaryListParams{
			ID:        stripe.String(meterID),
			Customer:  stripe.String(customerID),
			StartTime: stripe.Int64(start.Unix()),
			EndTime:   stripe.Int64(end.Unix()),
		}
		var total float64
		iter := metereventsummary.List(params)
		for iter.Next() {
			summary := iter.BillingMeterEventSummary()
			total += summary.AggregatedValue
		}
		if err := iter.Err(); err != nil {
			t.Fatalf("list meter event summaries: %v", err)
		}
		if total >= expectedTotal {
			t.Logf("Meter aggregation complete: %.0f (expected %.0f)", total, expectedTotal)
			return
		}
		t.Logf("Meter aggregation in progress: %.0f / %.0f", total, expectedTotal)
		time.Sleep(5 * time.Second)
	}
	t.Fatalf("meter aggregation did not reach expected total %.0f within %v", expectedTotal, timeout)
}

// ---------------------------------------------------------------------------
// Helper: compute units per day to exceed free tier
// ---------------------------------------------------------------------------

func computeUnitsPerDay(freeTierLimit int64, daysInMonth int) (eventsPerDay, spansPerDay uint64) {
	targetOverage := freeTierLimit / 1000
	if targetOverage < 1000 {
		targetOverage = 1000
	}
	totalNeeded := freeTierLimit + targetOverage
	unitsPerDay := (totalNeeded + int64(daysInMonth) - 1) / int64(daysInMonth) // ceil
	eventsPerDay = uint64(unitsPerDay) / 2
	spansPerDay = uint64(unitsPerDay) - eventsPerDay
	return
}

// ---------------------------------------------------------------------------
// Helper: create a payment method and set as customer default
// ---------------------------------------------------------------------------

func createAndSetPaymentMethod(t *testing.T, customerID, pmToken string) string {
	t.Helper()

	pm, err := paymentmethod.Attach(pmToken, &stripe.PaymentMethodAttachParams{
		Customer: stripe.String(customerID),
	})
	if err != nil {
		t.Fatalf("attach payment method %s: %v", pmToken, err)
	}

	_, err = customer.Update(customerID, &stripe.CustomerParams{
		InvoiceSettings: &stripe.CustomerInvoiceSettingsParams{
			DefaultPaymentMethod: stripe.String(pm.ID),
		},
	})
	if err != nil {
		t.Fatalf("set default payment method: %v", err)
	}

	return pm.ID
}

// ---------------------------------------------------------------------------
// Helper: detach all payment methods from a customer
// ---------------------------------------------------------------------------

func detachAllPaymentMethods(t *testing.T, customerID string) {
	t.Helper()
	params := &stripe.PaymentMethodListParams{
		Customer: stripe.String(customerID),
		Type:     stripe.String("card"),
	}
	iter := paymentmethod.List(params)
	for iter.Next() {
		pm := iter.PaymentMethod()
		_, err := paymentmethod.Detach(pm.ID, nil)
		if err != nil {
			t.Fatalf("detach payment method %s: %v", pm.ID, err)
		}
	}
	if err := iter.Err(); err != nil {
		t.Fatalf("list payment methods: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Helper: advance test clock to a given time
// ---------------------------------------------------------------------------

func advanceClock(t *testing.T, clockID string, to time.Time) {
	t.Helper()
	_, err := testclock.Advance(clockID, &stripe.TestHelpersTestClockAdvanceParams{
		FrozenTime: stripe.Int64(to.Unix()),
	})
	if err != nil {
		t.Fatalf("advance test clock to %s: %v", to.Format(time.RFC3339), err)
	}
	waitForTestClockReady(t, clockID, 5*time.Minute)
}

// ---------------------------------------------------------------------------
// Helper: find invoices for a customer
// ---------------------------------------------------------------------------

func listCustomerInvoices(t *testing.T, customerID string) []*stripe.Invoice {
	t.Helper()
	var invoices []*stripe.Invoice
	params := &stripe.InvoiceListParams{
		Customer: stripe.String(customerID),
	}
	iter := invoice.List(params)
	for iter.Next() {
		invoices = append(invoices, iter.Invoice())
	}
	if err := iter.Err(); err != nil {
		t.Fatalf("list invoices: %v", err)
	}
	return invoices
}

// ---------------------------------------------------------------------------
// Helper: find invoices for a subscription
// ---------------------------------------------------------------------------

func listSubscriptionInvoices(t *testing.T, subscriptionID string) []*stripe.Invoice {
	t.Helper()
	var invoices []*stripe.Invoice
	params := &stripe.InvoiceListParams{
		Subscription: stripe.String(subscriptionID),
	}
	iter := invoice.List(params)
	for iter.Next() {
		invoices = append(invoices, iter.Invoice())
	}
	if err := iter.Err(); err != nil {
		t.Fatalf("list invoices for subscription %s: %v", subscriptionID, err)
	}
	return invoices
}

// ---------------------------------------------------------------------------
// Helper: build deps with real Stripe SDK calls for functional tests
// ---------------------------------------------------------------------------

func integrationDeps(meterName string) Deps {
	return Deps{
		PgPool:         th.PgPool,
		ChPool:         th.ChConn,
		SiteOrigin:     "https://test.measure.sh",
		TxEmailAddress: "noreply@test.measure.sh",
		MeterName:      meterName,
		GetSubscription: func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			return subscription.Get(id, params)
		},
		ReportToStripe: func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			return meterevent.New(params)
		},
	}
}

// ---------------------------------------------------------------------------
// Helpers: scenario setup
// ---------------------------------------------------------------------------

type stripeScenarioFixture struct {
	deps          Deps
	meterID       string
	priceID       string
	tiers         []*stripe.PriceTier
	tiersMode     stripe.PriceTiersMode
	freeTierLimit int64
	clockID       string
	customerID    string
	subscription  string
	teamID        string
}

func requireStripeBillingCycleEnv(t *testing.T) (string, string, string) {
	t.Helper()

	stripeKey := os.Getenv("TEST_STRIPE_API_KEY")
	meterName := os.Getenv("TEST_STRIPE_UNIT_DAYS_METER_NAME")
	priceID := os.Getenv("TEST_STRIPE_PRO_UNIT_DAYS_PRICE_ID")
	if stripeKey == "" || meterName == "" || priceID == "" {
		t.Fatalf("TEST_STRIPE_API_KEY, TEST_STRIPE_UNIT_DAYS_METER_NAME, and TEST_STRIPE_PRO_UNIT_DAYS_PRICE_ID must be set")
	}

	return stripeKey, meterName, priceID
}

func loadPriceTiersAndFreeLimit(t *testing.T, priceID string) ([]*stripe.PriceTier, stripe.PriceTiersMode, int64) {
	t.Helper()

	priceParams := &stripe.PriceParams{}
	priceParams.AddExpand("tiers")
	p, err := price.Get(priceID, priceParams)
	if err != nil {
		t.Fatalf("fetch price %s: %v", priceID, err)
	}
	if len(p.Tiers) == 0 {
		t.Fatalf("price %s has no tiers", priceID)
	}

	var freeTierLimit int64
	for _, tier := range p.Tiers {
		if tier.UnitAmount == 0 && tier.UnitAmountDecimal == 0 && tier.UpTo > 0 {
			freeTierLimit = tier.UpTo
			break
		}
	}
	if freeTierLimit == 0 {
		t.Fatalf("could not find free tier limit for price %s", priceID)
	}

	return p.Tiers, p.TiersMode, freeTierLimit
}

func newProStripeScenarioFixture(t *testing.T, ctx context.Context, scenarioName string) stripeScenarioFixture {
	t.Helper()

	stripeKey, meterName, priceID := requireStripeBillingCycleEnv(t)

	origKey := stripe.Key
	stripe.Key = stripeKey
	t.Cleanup(func() { stripe.Key = origKey })

	deps := integrationDeps(meterName)
	meterID := findMeterID(t, meterName)
	tiers, tiersMode, freeTierLimit := loadPriceTiersAndFreeLimit(t, priceID)

	clockStart := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	clock, err := testclock.New(&stripe.TestHelpersTestClockParams{
		FrozenTime: stripe.Int64(clockStart.Unix()),
		Name:       stripe.String("billing-cycle-" + scenarioName),
	})
	if err != nil {
		t.Fatalf("create test clock: %v", err)
	}
	t.Cleanup(func() {
		testclock.Del(clock.ID, nil)
	})

	cust, err := customer.New(&stripe.CustomerParams{
		TestClock:     stripe.String(clock.ID),
		Name:          stripe.String("Billing Cycle Test Customer"),
		Email:         stripe.String("billing-test@example.com"),
		PaymentMethod: stripe.String("pm_card_visa"),
		InvoiceSettings: &stripe.CustomerInvoiceSettingsParams{
			DefaultPaymentMethod: stripe.String("pm_card_visa"),
		},
	})
	if err != nil {
		t.Fatalf("create customer: %v", err)
	}

	sub, err := subscription.New(&stripe.SubscriptionParams{
		Customer: stripe.String(cust.ID),
		Items: []*stripe.SubscriptionItemsParams{{
			Price: stripe.String(priceID),
		}},
	})
	if err != nil {
		t.Fatalf("create subscription: %v", err)
	}
	teamID := uuid.New().String()
	t.Cleanup(func() { cleanupAll(ctx, t) })
	th.SeedTeam(ctx, t, teamID, "BillingCycleTest", true)
	th.SeedTeamBilling(ctx, t, teamID, "pro", strPtr(cust.ID), strPtr(sub.ID))

	return stripeScenarioFixture{
		deps:          deps,
		meterID:       meterID,
		priceID:       priceID,
		tiers:         tiers,
		tiersMode:     tiersMode,
		freeTierLimit: freeTierLimit,
		clockID:       clock.ID,
		customerID:    cust.ID,
		subscription:  sub.ID,
		teamID:        teamID,
	}
}

func assertCycleInvoicePaidWithAmount(t *testing.T, subID string, expectedAmount int64) {
	t.Helper()
	invoices := listSubscriptionInvoices(t, subID)
	for _, inv := range invoices {
		if inv.Status == stripe.InvoiceStatusPaid && inv.BillingReason == stripe.InvoiceBillingReasonSubscriptionCycle {
			if inv.AmountDue != expectedAmount {
				t.Fatalf("invoice amount mismatch: expected %d, got %d", expectedAmount, inv.AmountDue)
			}
			return
		}
	}
	t.Fatalf("no paid cycle invoice found; statuses: %v", invoiceStatuses(invoices))
}

func advanceToTerminalStatus(t *testing.T, clockID, subscriptionID string) stripe.SubscriptionStatus {
	t.Helper()
	advanceClock(t, clockID, time.Date(2026, 3, 5, 0, 0, 0, 0, time.UTC))
	advanceClock(t, clockID, time.Date(2026, 3, 15, 0, 0, 0, 0, time.UTC))
	advanceClock(t, clockID, time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC))

	updatedSub, err := subscription.Get(subscriptionID, nil)
	if err != nil {
		t.Fatalf("get subscription: %v", err)
	}
	if !IsTerminalSubscriptionStatus(updatedSub.Status) {
		t.Fatalf("expected terminal status, got %s", updatedSub.Status)
	}
	return updatedSub.Status
}

func invoiceStatuses(invoices []*stripe.Invoice) []string {
	statuses := make([]string, len(invoices))
	for i, inv := range invoices {
		statuses[i] = fmt.Sprintf("%s:%s", inv.ID, inv.Status)
	}
	return statuses
}

// ---------------------------------------------------------------------------
// Scenario tests
// ---------------------------------------------------------------------------

func TestBillingCycle_ProSuccess_OneMonthProcessed(t *testing.T) {
	ctx := context.Background()
	f := newProStripeScenarioFixture(t, ctx, "pro-success")
	janDays := 31
	eventsPerDay, spansPerDay := computeUnitsPerDay(f.freeTierLimit, janDays)
	unitsPerDay := int64(eventsPerDay + spansPerDay)
	seededDays := seedMonthForReporting(ctx, t, f.teamID, 2026, time.January, eventsPerDay, spansPerDay)
	if seededDays != janDays {
		t.Fatalf("seeded days = %d, want %d", seededDays, janDays)
	}

	advanceClock(t, f.clockID, time.Date(2026, 1, 31, 23, 59, 0, 0, time.UTC))
	if err := ReportUnreportedToStripe(ctx, f.deps); err != nil {
		t.Fatalf("ReportUnreportedToStripe: %v", err)
	}

	if got := countReportedRows(ctx, t, f.teamID); got != janDays {
		t.Fatalf("reported rows = %d, want %d", got, janDays)
	}
	janTotal := unitsPerDay * int64(janDays)

	waitForMeterAggregation(t, f.meterID, f.customerID,
		time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC),
		float64(janTotal), 2*time.Minute)

	advanceClock(t, f.clockID, time.Date(2026, 2, 5, 0, 0, 0, 0, time.UTC))
	assertCycleInvoicePaidWithAmount(t, f.subscription, calculateTieredAmount(janTotal, f.tiers, f.tiersMode))

	bc := getTeamBilling(ctx, t, uuid.MustParse(f.teamID))
	if bc.Plan != "pro" {
		t.Fatalf("plan = %s, want pro", bc.Plan)
	}
	allow, reason := getTeamIngestStatus(ctx, t, f.teamID)
	if !allow || reason != nil {
		t.Fatalf("allow_ingest=%v reason=%v, want true,nil", allow, safeDeref(reason))
	}
}

func TestBillingCycle_ProFailure_FreeLimitExceeded_OneMonthProcessed(t *testing.T) {
	ctx := context.Background()
	f := newProStripeScenarioFixture(t, ctx, "pro-failure-exceeded")
	eventsPerDay, spansPerDay := computeUnitsPerDay(f.freeTierLimit, 28)
	seedMonthForReporting(ctx, t, f.teamID, 2026, time.February, eventsPerDay, spansPerDay)
	detachAllPaymentMethods(t, f.customerID)

	advanceClock(t, f.clockID, time.Date(2026, 2, 28, 23, 59, 0, 0, time.UTC))
	if err := ReportUnreportedToStripe(ctx, f.deps); err != nil {
		t.Fatalf("ReportUnreportedToStripe: %v", err)
	}

	finalStatus := advanceToTerminalStatus(t, f.clockID, f.subscription)
	seedCurrentMonthIngestionUsage(ctx, t, f.teamID, uint64(FreePlanMaxUnits)+1000)

	subEventRaw, err := json.Marshal(map[string]any{
		"id":     f.subscription,
		"status": string(finalStatus),
	})
	if err != nil {
		t.Fatalf("marshal subscription event: %v", err)
	}
	HandleSubscriptionUpdated(ctx, f.deps, stripe.Event{
		Type: "customer.subscription.updated",
		Data: &stripe.EventData{Raw: subEventRaw},
	})

	bc := getTeamBilling(ctx, t, uuid.MustParse(f.teamID))
	if bc.Plan != "free" {
		t.Fatalf("plan = %s, want free", bc.Plan)
	}
	allow, reason := getTeamIngestStatus(ctx, t, f.teamID)
	if allow {
		t.Fatalf("allow_ingest=%v, want false", allow)
	}
	if reason == nil || *reason != ReasonPlanLimitExceeded {
		t.Fatalf("reason=%v, want %q", safeDeref(reason), ReasonPlanLimitExceeded)
	}
}

func TestBillingCycle_ProFailure_WithinFreeLimits_OneMonthProcessed(t *testing.T) {
	ctx := context.Background()
	f := newProStripeScenarioFixture(t, ctx, "pro-failure-within")
	eventsPerDay, spansPerDay := computeUnitsPerDay(f.freeTierLimit, 28)
	seedMonthForReporting(ctx, t, f.teamID, 2026, time.February, eventsPerDay, spansPerDay)
	detachAllPaymentMethods(t, f.customerID)

	advanceClock(t, f.clockID, time.Date(2026, 2, 28, 23, 59, 0, 0, time.UTC))
	if err := ReportUnreportedToStripe(ctx, f.deps); err != nil {
		t.Fatalf("ReportUnreportedToStripe: %v", err)
	}

	finalStatus := advanceToTerminalStatus(t, f.clockID, f.subscription)
	seedCurrentMonthIngestionUsage(ctx, t, f.teamID, uint64(FreePlanMaxUnits)-1000)

	subEventRaw, err := json.Marshal(map[string]any{
		"id":     f.subscription,
		"status": string(finalStatus),
	})
	if err != nil {
		t.Fatalf("marshal subscription event: %v", err)
	}
	HandleSubscriptionUpdated(ctx, f.deps, stripe.Event{
		Type: "customer.subscription.updated",
		Data: &stripe.EventData{Raw: subEventRaw},
	})

	bc := getTeamBilling(ctx, t, uuid.MustParse(f.teamID))
	if bc.Plan != "free" {
		t.Fatalf("plan = %s, want free", bc.Plan)
	}
	allow, reason := getTeamIngestStatus(ctx, t, f.teamID)
	if !allow || reason != nil {
		t.Fatalf("allow_ingest=%v reason=%v, want true,nil", allow, safeDeref(reason))
	}
}

func TestBillingCycle_ProFailure_FreeLimitExceeded_OneMonthProcessed_HourlyFallback(t *testing.T) {
	ctx := context.Background()
	f := newProStripeScenarioFixture(t, ctx, "pro-failure-exceeded-hourly")
	eventsPerDay, spansPerDay := computeUnitsPerDay(f.freeTierLimit, 28)
	seedMonthForReporting(ctx, t, f.teamID, 2026, time.February, eventsPerDay, spansPerDay)
	detachAllPaymentMethods(t, f.customerID)

	advanceClock(t, f.clockID, time.Date(2026, 2, 28, 23, 59, 0, 0, time.UTC))
	if err := ReportUnreportedToStripe(ctx, f.deps); err != nil {
		t.Fatalf("ReportUnreportedToStripe: %v", err)
	}

	_ = advanceToTerminalStatus(t, f.clockID, f.subscription)
	seedCurrentMonthIngestionUsage(ctx, t, f.teamID, uint64(FreePlanMaxUnits)+1000)

	// Webhook path intentionally skipped: hourly check should catch terminal status.
	RunHourlyBillingCheck(ctx, f.deps)

	bc := getTeamBilling(ctx, t, uuid.MustParse(f.teamID))
	if bc.Plan != "free" {
		t.Fatalf("plan = %s, want free", bc.Plan)
	}
	allow, reason := getTeamIngestStatus(ctx, t, f.teamID)
	if allow {
		t.Fatalf("allow_ingest=%v, want false", allow)
	}
	if reason == nil || *reason != ReasonPlanLimitExceeded {
		t.Fatalf("reason=%v, want %q", safeDeref(reason), ReasonPlanLimitExceeded)
	}
}

func TestBillingCycle_ProFailure_WithinFreeLimits_OneMonthProcessed_HourlyFallback(t *testing.T) {
	ctx := context.Background()
	f := newProStripeScenarioFixture(t, ctx, "pro-failure-within-hourly")
	eventsPerDay, spansPerDay := computeUnitsPerDay(f.freeTierLimit, 28)
	seedMonthForReporting(ctx, t, f.teamID, 2026, time.February, eventsPerDay, spansPerDay)
	detachAllPaymentMethods(t, f.customerID)

	advanceClock(t, f.clockID, time.Date(2026, 2, 28, 23, 59, 0, 0, time.UTC))
	if err := ReportUnreportedToStripe(ctx, f.deps); err != nil {
		t.Fatalf("ReportUnreportedToStripe: %v", err)
	}

	_ = advanceToTerminalStatus(t, f.clockID, f.subscription)
	seedCurrentMonthIngestionUsage(ctx, t, f.teamID, uint64(FreePlanMaxUnits)-1000)

	// Webhook path intentionally skipped: hourly check should catch terminal status.
	RunHourlyBillingCheck(ctx, f.deps)

	bc := getTeamBilling(ctx, t, uuid.MustParse(f.teamID))
	if bc.Plan != "free" {
		t.Fatalf("plan = %s, want free", bc.Plan)
	}
	allow, reason := getTeamIngestStatus(ctx, t, f.teamID)
	if !allow || reason != nil {
		t.Fatalf("allow_ingest=%v reason=%v, want true,nil", allow, safeDeref(reason))
	}
}

func TestBillingCycle_ProFailure_DunningRetryTimeline(t *testing.T) {
	ctx := context.Background()
	f := newProStripeScenarioFixture(t, ctx, "pro-failure-retries")
	eventsPerDay, spansPerDay := computeUnitsPerDay(f.freeTierLimit, 28)
	seedMonthForReporting(ctx, t, f.teamID, 2026, time.February, eventsPerDay, spansPerDay)
	detachAllPaymentMethods(t, f.customerID)

	advanceClock(t, f.clockID, time.Date(2026, 2, 28, 23, 59, 0, 0, time.UTC))
	if err := ReportUnreportedToStripe(ctx, f.deps); err != nil {
		t.Fatalf("ReportUnreportedToStripe: %v", err)
	}

	checkpoints := []time.Time{
		time.Date(2026, 3, 5, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC),
	}

	sawNonActive := false
	for _, ts := range checkpoints {
		advanceClock(t, f.clockID, ts)
		sub, err := subscription.Get(f.subscription, nil)
		if err != nil {
			t.Fatalf("get subscription at %s: %v", ts.Format(time.RFC3339), err)
		}
		if sub.Status != stripe.SubscriptionStatusActive {
			sawNonActive = true
		}
	}
	if !sawNonActive {
		t.Fatal("expected non-active status during retry timeline")
	}

	finalSub, err := subscription.Get(f.subscription, nil)
	if err != nil {
		t.Fatalf("get final subscription: %v", err)
	}
	if !IsTerminalSubscriptionStatus(finalSub.Status) {
		t.Fatalf("expected terminal subscription status after retries, got %s", finalSub.Status)
	}
}

func TestBillingCycle_ProFailure_DowngradeSideEffects(t *testing.T) {
	ctx := context.Background()
	f := newProStripeScenarioFixture(t, ctx, "pro-failure-side-effects")

	userID := uuid.New().String()
	th.SeedUser(ctx, t, userID, "owner@example.com")
	th.SeedTeamMembership(ctx, t, f.teamID, userID, "owner")
	appID := uuid.New()
	th.SeedApp(ctx, t, appID.String(), f.teamID, "side-effects-app", 180)

	eventsPerDay, spansPerDay := computeUnitsPerDay(f.freeTierLimit, 28)
	seedMonthForReporting(ctx, t, f.teamID, 2026, time.February, eventsPerDay, spansPerDay)
	detachAllPaymentMethods(t, f.customerID)
	advanceClock(t, f.clockID, time.Date(2026, 2, 28, 23, 59, 0, 0, time.UTC))
	if err := ReportUnreportedToStripe(ctx, f.deps); err != nil {
		t.Fatalf("ReportUnreportedToStripe: %v", err)
	}

	_ = advanceToTerminalStatus(t, f.clockID, f.subscription)
	seedCurrentMonthIngestionUsage(ctx, t, f.teamID, uint64(FreePlanMaxUnits)+1000)
	RunHourlyBillingCheck(ctx, f.deps)

	bc := getTeamBilling(ctx, t, uuid.MustParse(f.teamID))
	if bc.Plan != "free" {
		t.Fatalf("plan = %s, want free", bc.Plan)
	}
	if bc.StripeSubscriptionID != nil {
		t.Fatalf("stripe_subscription_id = %v, want nil", *bc.StripeSubscriptionID)
	}

	if got := getAppRetention(ctx, t, appID); got != FreePlanMaxRetentionDays {
		t.Fatalf("app retention = %d, want %d", got, FreePlanMaxRetentionDays)
	}

	var pendingCount int
	if err := th.PgPool.QueryRow(ctx, "SELECT COUNT(*) FROM pending_alert_messages WHERE team_id = $1", f.teamID).Scan(&pendingCount); err != nil {
		t.Fatalf("count pending alerts: %v", err)
	}
	if pendingCount == 0 {
		t.Fatal("expected subscription failure notification emails to be queued")
	}
}
