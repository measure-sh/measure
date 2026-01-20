//go:build integration

package billing

import (
	"backend/testinfra"
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
	"github.com/stripe/stripe-go/v84"
)

// --------------------------------------------------------------------------
// TestMain — one-time setup: spin up containers, run migrations
// --------------------------------------------------------------------------

var (
	th *testinfra.TestHelper
)

func TestMain(m *testing.M) {
	ctx := context.Background()

	pgPool, pgCleanup := testinfra.SetupPostgres(ctx)
	chConn, chCleanup := testinfra.SetupClickHouse(ctx)
	vk, vkCleanup := testinfra.SetupValkey(ctx)

	th = testinfra.NewTestHelper(pgPool, chConn, vk)

	sqlf.SetDialect(sqlf.PostgreSQL)

	code := m.Run()

	vkCleanup()
	pgCleanup()
	chCleanup()
	os.Exit(code)
}

// --------------------------------------------------------------------------
// Helper: build test Deps
// --------------------------------------------------------------------------

func testDeps() Deps {
	return Deps{
		PgPool:         th.PgPool,
		ChPool:         th.ChConn,
		SiteOrigin:     "https://test.measure.sh",
		TxEmailAddress: "noreply@test.measure.sh",
		MeterName:      "test_unit_days",
		GetSubscription: func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
			panic("GetSubscription not mocked")
		},
		ReportToStripe: func(params *stripe.BillingMeterEventParams) (*stripe.BillingMeterEvent, error) {
			panic("ReportToStripe not mocked")
		},
	}
}

// --------------------------------------------------------------------------
// Thin wrappers delegating to testinfra.TestHelper
// --------------------------------------------------------------------------

func strPtr(s string) *string { return testinfra.StrPtr(s) }
func int64Ptr(n int64) *int64 { return testinfra.Int64Ptr(n) }

func cleanupAll(ctx context.Context, t *testing.T) {
	th.CleanupAll(ctx, t)
}

func seedTeamWithBilling(ctx context.Context, t *testing.T, teamID, teamName, plan string, allowIngest bool) {
	t.Helper()
	th.SeedTeam(ctx, t, teamID, teamName, allowIngest)
	th.SeedTeamBilling(ctx, t, teamID, plan, nil, nil)
}

func seedTeam(ctx context.Context, t *testing.T, teamID uuid.UUID, name string, allowIngest bool) {
	th.SeedTeam(ctx, t, teamID.String(), name, allowIngest)
}

func seedTeamBilling(ctx context.Context, t *testing.T, teamID uuid.UUID, plan string, stripeCustomerID, stripeSubscriptionID *string) {
	th.SeedTeamBilling(ctx, t, teamID.String(), plan, stripeCustomerID, stripeSubscriptionID)
}

func seedUser(ctx context.Context, t *testing.T, userID, email string) {
	th.SeedUser(ctx, t, userID, email)
}

func seedTeamMembership(ctx context.Context, t *testing.T, teamID, userID, role string) {
	th.SeedTeamMembership(ctx, t, teamID, userID, role)
}

func seedIngestionUsage(ctx context.Context, t *testing.T, teamID, appID string, ts time.Time, events, spans, metrics uint32) {
	th.SeedIngestionUsage(ctx, t, teamID, appID, ts, events, spans, metrics)
}

func seedEvents(ctx context.Context, t *testing.T, teamID, appID string, count int) {
	th.SeedEvents(ctx, t, teamID, appID, count)
}

func seedSpans(ctx context.Context, t *testing.T, teamID, appID string, count int) {
	th.SeedSpans(ctx, t, teamID, appID, count)
}

func seedBillingMetricsReporting(ctx context.Context, t *testing.T, teamID string, reportDate time.Time, events, spans, metrics uint64, reported bool) {
	th.SeedBillingMetricsReporting(ctx, t, teamID, reportDate, events, spans, metrics, reported)
}

func setStripeCustomerID(ctx context.Context, t *testing.T, teamID, customerID string) {
	th.SetStripeCustomerID(ctx, t, teamID, customerID)
}

func seedApp(ctx context.Context, t *testing.T, appID, teamID uuid.UUID, retention int) {
	t.Helper()
	th.SeedApp(ctx, t, appID.String(), teamID.String(), appID.String()[:8], retention)
}

func seedTeamIngestBlocked(ctx context.Context, t *testing.T, teamID uuid.UUID, reason string) {
	th.SeedTeamIngestBlocked(ctx, t, teamID.String(), reason)
}

// --------------------------------------------------------------------------
// Read helpers for assertions
// --------------------------------------------------------------------------

func getTeamBilling(ctx context.Context, t *testing.T, teamID uuid.UUID) TeamBilling {
	t.Helper()

	var bc TeamBilling
	err := th.PgPool.QueryRow(ctx,
		`SELECT team_id, plan, stripe_customer_id, stripe_subscription_id, created_at, updated_at
		 FROM team_billing WHERE team_id = $1`, teamID).
		Scan(&bc.TeamID, &bc.Plan, &bc.StripeCustomerID, &bc.StripeSubscriptionID, &bc.CreatedAt, &bc.UpdatedAt)
	if err != nil {
		t.Fatalf("get team_billing: %v", err)
	}
	return bc
}

func getTeamAllowIngest(ctx context.Context, t *testing.T, teamID uuid.UUID) bool {
	t.Helper()

	var allow bool
	err := th.PgPool.QueryRow(ctx,
		`SELECT allow_ingest FROM teams WHERE id = $1`, teamID).Scan(&allow)
	if err != nil {
		t.Fatalf("get allow_ingest: %v", err)
	}
	return allow
}

func getAppRetention(ctx context.Context, t *testing.T, appID uuid.UUID) int {
	t.Helper()

	var retention int
	err := th.PgPool.QueryRow(ctx,
		`SELECT retention FROM apps WHERE id = $1`, appID).Scan(&retention)
	if err != nil {
		t.Fatalf("get app retention: %v", err)
	}
	return retention
}

func getTeamIngestBlockedReason(ctx context.Context, t *testing.T, teamID uuid.UUID) *string {
	t.Helper()

	var reason *string
	err := th.PgPool.QueryRow(ctx,
		`SELECT ingest_blocked_reason FROM teams WHERE id = $1`, teamID).Scan(&reason)
	if err != nil {
		t.Fatalf("get ingest_blocked_reason: %v", err)
	}
	return reason
}

func getTeamIngestStatus(ctx context.Context, t *testing.T, teamID string) (allowIngest bool, reason *string) {
	t.Helper()
	err := th.PgPool.QueryRow(ctx,
		"SELECT allow_ingest, ingest_blocked_reason FROM teams WHERE id = $1",
		teamID).Scan(&allowIngest, &reason)
	if err != nil {
		t.Fatalf("get team ingest status: %v", err)
	}
	return
}

// --------------------------------------------------------------------------
// Shared helpers (used by both integration and functional tests)
// --------------------------------------------------------------------------

func seedMonthForReporting(ctx context.Context, t *testing.T, teamID string, year int, month time.Month, eventsPerDay, spansPerDay uint64) int {
	t.Helper()
	days := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
	for day := 1; day <= days; day++ {
		date := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
		seedBillingMetricsReporting(ctx, t, teamID, date, eventsPerDay, spansPerDay, 0, false)
	}
	return days
}

func countReportedRows(ctx context.Context, t *testing.T, teamID string) int {
	t.Helper()
	var count int
	err := th.PgPool.QueryRow(ctx,
		"SELECT count(*) FROM billing_metrics_reporting WHERE team_id = $1 AND reported_at IS NOT NULL",
		teamID).Scan(&count)
	if err != nil {
		t.Fatalf("count reported rows: %v", err)
	}
	return count
}

func seedCurrentMonthIngestionUsage(ctx context.Context, t *testing.T, teamID string, totalUnits uint64) {
	t.Helper()
	appID := uuid.New().String()
	events := uint32(totalUnits / 2)
	spans := uint32(totalUnits - uint64(events))
	seedIngestionUsage(ctx, t, teamID, appID, time.Now().UTC(), events, spans, 0)
}

func safeDeref(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}
