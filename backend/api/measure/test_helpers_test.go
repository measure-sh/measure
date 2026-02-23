//go:build integration

package measure

import (
	"backend/api/server"
	"backend/billing"
	"backend/testinfra"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stripe/stripe-go/v84"
)

// --------------------------------------------------------------------------
// TestMain — one-time setup: spin up containers, run migrations, wire server
// --------------------------------------------------------------------------

var th *testinfra.TestHelper

func TestMain(m *testing.M) {
	ctx := context.Background()

	pgPool, pgCleanup := testinfra.SetupPostgres(ctx)
	chConn, chCleanup := testinfra.SetupClickHouse(ctx)
	vk, vkCleanup := testinfra.SetupValkey(ctx)

	th = testinfra.NewTestHelper(pgPool, chConn, vk)

	server.InitForTest(&server.ServerConfig{
		BillingEnabled: true,
	}, pgPool, chConn, vk)

	code := m.Run()

	vkCleanup()
	pgCleanup()
	chCleanup()
	os.Exit(code)
}

// --------------------------------------------------------------------------
// Thin wrappers delegating to testinfra.TestHelper
// --------------------------------------------------------------------------

func strPtr(s string) *string { return testinfra.StrPtr(s) }
func int64Ptr(n int64) *int64 { return testinfra.Int64Ptr(n) }

func cleanupAll(ctx context.Context, t *testing.T) {
	th.CleanupAll(ctx, t)
}

func seedTeam(ctx context.Context, t *testing.T, teamID uuid.UUID, name string, allowIngest bool) {
	th.SeedTeam(ctx, t, teamID.String(), name, allowIngest)
}

func seedUser(ctx context.Context, t *testing.T, userID, email string) {
	th.SeedUser(ctx, t, userID, email)
}

func seedTeamMembership(ctx context.Context, t *testing.T, teamID uuid.UUID, userID, role string) {
	th.SeedTeamMembership(ctx, t, teamID.String(), userID, role)
}

func seedApp(ctx context.Context, t *testing.T, appID, teamID uuid.UUID, retention int) {
	th.SeedApp(ctx, t, appID.String(), teamID.String(), fmt.Sprintf("app-%s", appID.String()[:8]), retention)
}

func seedTeamBilling(ctx context.Context, t *testing.T, teamID uuid.UUID, plan string, stripeCustomerID, stripeSubscriptionID *string) {
	th.SeedTeamBilling(ctx, t, teamID.String(), plan, stripeCustomerID, stripeSubscriptionID)
}

func seedTeamIngestBlocked(ctx context.Context, t *testing.T, teamID uuid.UUID, reason string) {
	th.SeedTeamIngestBlocked(ctx, t, teamID.String(), reason)
}

func seedAPIKey(
	ctx context.Context,
	t *testing.T,
	appID uuid.UUID,
	keyPrefix, keyValue, checksum string,
	revoked bool,
	lastSeen *time.Time,
	createdAt time.Time,
) {
	th.SeedAPIKey(ctx, t, appID.String(), keyPrefix, keyValue, checksum, revoked, lastSeen, createdAt)
}

func seedGenericEvents(ctx context.Context, t *testing.T, teamID, appID string, count int, ts time.Time) {
	th.SeedGenericEvents(ctx, t, teamID, appID, count, ts)
}

func seedIssueEvent(
	ctx context.Context,
	t *testing.T,
	teamID, appID, eventType, fingerprint string,
	handled bool,
	ts time.Time,
) {
	th.SeedIssueEvent(ctx, t, teamID, appID, eventType, fingerprint, handled, ts)
}

func seedBugReport(ctx context.Context, t *testing.T, teamID, appID, eventID, description string, ts time.Time) {
	th.SeedBugReport(ctx, t, teamID, appID, eventID, description, ts)
}

func seedSpan(
	ctx context.Context,
	t *testing.T,
	teamID, appID, spanName string,
	status uint8,
	startTime, endTime time.Time,
	appVersion, appBuild string,
) {
	th.SeedSpan(ctx, t, teamID, appID, spanName, status, startTime, endTime, appVersion, appBuild)
}

// --------------------------------------------------------------------------
// Gin test context
// --------------------------------------------------------------------------

func newTestGinContext(method, path string, body io.Reader) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, body)
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

// --------------------------------------------------------------------------
// Config helpers
// --------------------------------------------------------------------------

func setStripeConfig(t *testing.T, priceID, webhookSecret string) {
	t.Helper()
	origPrice := server.Server.Config.StripeProUnitDaysPriceID
	origSecret := server.Server.Config.StripeWebhookSecret
	server.Server.Config.StripeProUnitDaysPriceID = priceID
	server.Server.Config.StripeWebhookSecret = webhookSecret
	t.Cleanup(func() {
		server.Server.Config.StripeProUnitDaysPriceID = origPrice
		server.Server.Config.StripeWebhookSecret = origSecret
	})
}

// --------------------------------------------------------------------------
// Stripe mock helpers
// --------------------------------------------------------------------------

func mockCreateStripeCustomer(t *testing.T, fn func(*stripe.CustomerParams) (*stripe.Customer, error)) {
	t.Helper()
	orig := billing.CreateStripeCustomerFn
	billing.CreateStripeCustomerFn = fn
	t.Cleanup(func() { billing.CreateStripeCustomerFn = orig })
}

func mockFindActiveSubscription(t *testing.T, fn func(string) (*stripe.Subscription, error)) {
	t.Helper()
	orig := billing.FindActiveSubscriptionFn
	billing.FindActiveSubscriptionFn = fn
	t.Cleanup(func() { billing.FindActiveSubscriptionFn = orig })
}

func mockCreateCheckoutSession(t *testing.T, fn func(*stripe.CheckoutSessionParams) (*stripe.CheckoutSession, error)) {
	t.Helper()
	orig := billing.CreateStripeCheckoutSessionFn
	billing.CreateStripeCheckoutSessionFn = fn
	t.Cleanup(func() { billing.CreateStripeCheckoutSessionFn = orig })
}

func mockCancelStripeSubscription(t *testing.T, fn func(string, *stripe.SubscriptionCancelParams) (*stripe.Subscription, error)) {
	t.Helper()
	orig := billing.CancelSubscriptionFn
	billing.CancelSubscriptionFn = fn
	t.Cleanup(func() { billing.CancelSubscriptionFn = orig })
}

func mockConstructWebhookEvent(t *testing.T, fn func([]byte, string, string) (stripe.Event, error)) {
	t.Helper()
	orig := constructWebhookEventFn
	constructWebhookEventFn = fn
	t.Cleanup(func() { constructWebhookEventFn = orig })
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

type apiKeyRow struct {
	ID        uuid.UUID
	AppID     uuid.UUID
	KeyPrefix string
	KeyValue  string
	Checksum  string
	Revoked   bool
	LastSeen  *time.Time
	CreatedAt time.Time
}

func getAPIKeysByAppID(ctx context.Context, t *testing.T, appID uuid.UUID) []apiKeyRow {
	t.Helper()

	rows, err := th.PgPool.Query(ctx,
		`SELECT id, app_id, key_prefix, key_value, checksum, revoked, last_seen, created_at
		 FROM api_keys WHERE app_id = $1 ORDER BY created_at`, appID)
	if err != nil {
		t.Fatalf("get api_keys by app_id: %v", err)
	}
	defer rows.Close()

	var out []apiKeyRow
	for rows.Next() {
		var r apiKeyRow
		if err := rows.Scan(&r.ID, &r.AppID, &r.KeyPrefix, &r.KeyValue, &r.Checksum, &r.Revoked, &r.LastSeen, &r.CreatedAt); err != nil {
			t.Fatalf("scan api_key row: %v", err)
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows err api_key: %v", err)
	}
	return out
}

func getAPIKeyByValue(ctx context.Context, t *testing.T, keyValue string) *apiKeyRow {
	t.Helper()

	var r apiKeyRow
	err := th.PgPool.QueryRow(ctx,
		`SELECT id, app_id, key_prefix, key_value, checksum, revoked, last_seen, created_at
		 FROM api_keys WHERE key_value = $1`, keyValue).
		Scan(&r.ID, &r.AppID, &r.KeyPrefix, &r.KeyValue, &r.Checksum, &r.Revoked, &r.LastSeen, &r.CreatedAt)
	if err != nil {
		return nil
	}
	return &r
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

// --------------------------------------------------------------------------
// Response body assertions
// --------------------------------------------------------------------------

func wantJSON(t *testing.T, w *httptest.ResponseRecorder, key string, want any) {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if m[key] != want {
		t.Errorf("response[%q] = %v, want %v", key, m[key], want)
	}
}

func wantJSONContains(t *testing.T, w *httptest.ResponseRecorder, key, substr string) {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	got, _ := m[key].(string)
	if !strings.Contains(got, substr) {
		t.Errorf("response[%q] = %q, want substring %q", key, got, substr)
	}
}
