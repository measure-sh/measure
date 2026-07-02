//go:build integration

package handlers

import (
	"backend/api/server"
	"backend/libs/autumn"
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
)

// --------------------------------------------------------------------------
// TestMain — one-time setup: spin up containers, run migrations, wire handlers.
//
// This mirrors the harness in libs/measure: thin shims over the importable
// testinfra.TestHelper. It builds api's own handlers.Handlers so api's gin
// handler tests run against the same container-backed stack.
// --------------------------------------------------------------------------

var (
	th   *testinfra.TestHelper
	deps *server.Deps
	h    Handlers
)

const testTeamName = "test-team"

func TestMain(m *testing.M) {
	ctx := context.Background()

	pgPool, pgCleanup := testinfra.SetupPostgres(ctx)
	chConn, chCleanup := testinfra.SetupClickHouse(ctx)
	vk, vkCleanup := testinfra.SetupValkey(ctx)

	th = testinfra.NewTestHelper(pgPool, chConn, vk)

	deps = &server.Deps{
		PgPool:  pgPool,
		ChPool:  chConn,
		RchPool: chConn,
		VK:      vk,
		Config: &server.Config{
			BillingEnabled: true,
		},
	}
	h = New(deps)

	// Default no-op Autumn mocks so tests that incidentally trigger team
	// creation (e.g. auth signup flows) don't need their own mocks.
	// Tests that care about Autumn behavior override these per-test.
	autumn.GetOrCreateCustomer = func(_ context.Context, id, email, name string) (*autumn.Customer, error) {
		return &autumn.Customer{ID: id, Email: email, Name: name}, nil
	}
	autumn.Attach = func(_ context.Context, req autumn.AttachRequest) (*autumn.AttachResponse, error) {
		return &autumn.AttachResponse{CustomerID: req.CustomerID}, nil
	}

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

func seedTeam(ctx context.Context, t *testing.T, teamID uuid.UUID, name string) {
	th.SeedTeam(ctx, t, teamID.String(), name)
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

func seedTeamAutumnCustomer(ctx context.Context, t *testing.T, teamID uuid.UUID, autumnCustomerID string) {
	th.SeedTeamAutumnCustomer(ctx, t, teamID.String(), autumnCustomerID)
}

// setUserAttribution inserts a row into measure.user_attribution for a user.
// Pass empty strings to exercise the SQL NULL → empty-string COALESCE behavior.
func setUserAttribution(ctx context.Context, t *testing.T, userID, gaClientID, gclid string) {
	t.Helper()
	var ga, g any
	if gaClientID != "" {
		ga = gaClientID
	}
	if gclid != "" {
		g = gclid
	}
	_, err := th.PgPool.Exec(ctx,
		`INSERT INTO user_attribution (user_id, ga_client_id, gclid) VALUES ($1, $2, $3)`,
		userID, ga, g)
	if err != nil {
		t.Fatalf("insert user_attribution: %v", err)
	}
}

func seedTeamAndMemberWithRole(t *testing.T, ctx context.Context, role string) (string, uuid.UUID) {
	t.Helper()

	userID := uuid.New().String()
	teamID := uuid.New()
	seedUser(ctx, t, userID, role+"-authz@test.com")
	seedTeam(ctx, t, teamID, testTeamName)
	seedTeamMembership(ctx, t, teamID, userID, role)
	return userID, teamID
}

func seedIngestionUsage(ctx context.Context, t *testing.T, teamID, appID string, ts time.Time, events, spans, metrics uint32, bytesIn uint64) {
	th.SeedIngestionUsage(ctx, t, teamID, appID, ts, events, spans, metrics, bytesIn)
}

func seedCurrentMonthIngestionUsage(ctx context.Context, t *testing.T, teamID string, totalBytes uint64) {
	t.Helper()
	appID := uuid.New().String()
	seedIngestionUsage(ctx, t, teamID, appID, time.Now().UTC(), 0, 0, 0, totalBytes)
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

func seedAppMetrics(ctx context.Context, t *testing.T, teamID, appID string, ts time.Time, genericCount, crashCount, anrCount int) {
	th.SeedAppMetrics(ctx, t, teamID, appID, ts, genericCount, crashCount, anrCount)
}

func seedEventRows(ctx context.Context, t *testing.T, teamID, appID string, count int, row testinfra.EventRow) {
	th.SeedEventRows(ctx, t, teamID, appID, count, row)
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

func seedIssueEventWithSeverity(
	ctx context.Context,
	t *testing.T,
	teamID, appID, fingerprint, severity string,
	ts time.Time,
) {
	th.SeedIssueEventWithSeverity(ctx, t, teamID, appID, fingerprint, severity, ts)
}

func seedExceptionGroup(ctx context.Context, t *testing.T, teamID, appID, fingerprint string) {
	th.SeedExceptionGroup(ctx, t, teamID, appID, fingerprint)
}

func seedFatalExceptionGroupWithCustomFlag(ctx context.Context, t *testing.T, teamID, appID, fingerprint string, isCustom bool) {
	th.SeedFatalExceptionGroupWithCustomFlag(ctx, t, teamID, appID, fingerprint, isCustom)
}

func seedNonfatalExceptionGroup(ctx context.Context, t *testing.T, teamID, appID, fingerprint string, handled, isCustom bool) {
	th.SeedNonfatalExceptionGroup(ctx, t, teamID, appID, fingerprint, handled, isCustom)
}

func seedIssueEventWithCustomFlag(ctx context.Context, t *testing.T, teamID, appID, fingerprint string, handled, isCustom bool, ts time.Time) {
	th.SeedIssueEventWithCustomFlag(ctx, t, teamID, appID, fingerprint, handled, isCustom, ts)
}

func seedAnrGroup(ctx context.Context, t *testing.T, teamID, appID, fingerprint string) {
	th.SeedAnrGroup(ctx, t, teamID, appID, fingerprint)
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
) string {
	return th.SeedSpan(ctx, t, teamID, appID, spanName, status, startTime, endTime, appVersion, appBuild)
}

func seedEventWithSession(ctx context.Context, t *testing.T, teamID, appID, sessionID string, ts time.Time) {
	th.SeedEventWithSession(ctx, t, teamID, appID, sessionID, ts)
}

func seedIssueEventInSession(
	ctx context.Context,
	t *testing.T,
	teamID, appID, sessionID, eventType, fingerprint string,
	handled bool,
	ts time.Time,
) {
	th.SeedIssueEventInSession(ctx, t, teamID, appID, sessionID, eventType, fingerprint, handled, ts)
}

func seedIssueEventWithDataInSession(
	ctx context.Context,
	t *testing.T,
	teamID, appID, sessionID, eventType, fingerprint string,
	handled bool,
	exceptionsJSON string,
	ts time.Time,
) {
	th.SeedIssueEventWithDataInSession(ctx, t, teamID, appID, sessionID, eventType, fingerprint, handled, exceptionsJSON, ts)
}

func seedNavigationEventInSession(ctx context.Context, t *testing.T, teamID, appID, sessionID, destination string, ts time.Time) {
	th.SeedNavigationEventInSession(ctx, t, teamID, appID, sessionID, destination, ts)
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
// Read helpers for assertions
// --------------------------------------------------------------------------

func getTeamAutumnCustomerID(ctx context.Context, t *testing.T, teamID uuid.UUID) *string {
	t.Helper()

	var id *string
	err := th.PgPool.QueryRow(ctx,
		`SELECT autumn_customer_id FROM teams WHERE id = $1`, teamID).Scan(&id)
	if err != nil {
		t.Fatalf("get autumn_customer_id: %v", err)
	}
	return id
}

// getFirstAppID returns the first app for a given team, failing the test
// if none exists. Used after CreateApp to look up the newly-created app.
func getFirstAppID(ctx context.Context, t *testing.T, teamID uuid.UUID) uuid.UUID {
	t.Helper()
	var appID uuid.UUID
	err := th.PgPool.QueryRow(ctx,
		`SELECT id FROM apps WHERE team_id = $1 ORDER BY created_at ASC LIMIT 1`, teamID).Scan(&appID)
	if err != nil {
		t.Fatalf("get first app id: %v", err)
	}
	return appID
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
