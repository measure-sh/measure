//go:build integration

package mcp

import (
	"backend/agent/server"
	"backend/libs/autumn"
	"backend/testinfra"
	"context"
	"fmt"
	"io"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// --------------------------------------------------------------------------
// TestMain — one-time setup: spin up containers, run migrations, wire server
// --------------------------------------------------------------------------

var (
	th   *testinfra.TestHelper
	deps *server.Deps
	h    Handlers
)

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
			AgentEnabled:   true,
		},
	}
	h = NewHandlers(deps)

	// Default no-op Autumn mocks so tests that incidentally trigger team
	// creation (e.g. MCP signup flows) don't need their own mocks.
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

// setConfig applies overrides to the shared test config and restores the
// previous values when the test finishes, so config changes never leak
// across tests and the suite stays order-independent. Tests must use this
// instead of assigning deps.Config fields directly.
func setConfig(t *testing.T, mutate func(c *server.Config)) {
	t.Helper()
	orig := *deps.Config
	mutate(deps.Config)
	t.Cleanup(func() { *deps.Config = orig })
}

// --------------------------------------------------------------------------
// Thin wrappers delegating to testinfra.TestHelper
// --------------------------------------------------------------------------

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

func seedAppMetrics(ctx context.Context, t *testing.T, teamID, appID string, ts time.Time, genericCount, crashCount, anrCount int) {
	th.SeedAppMetrics(ctx, t, teamID, appID, ts, genericCount, crashCount, anrCount)
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

func seedBuildMapping(ctx context.Context, t *testing.T, mappingID, appID, versionName, versionCode, mappingType string, lastUpdated time.Time) {
	th.SeedBuildMapping(ctx, t, mappingID, appID, versionName, versionCode, mappingType, lastUpdated)
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
// MCP seed / read helpers
// --------------------------------------------------------------------------

func seedMCPClient(ctx context.Context, t *testing.T, clientID, clientName string, redirectURIs []string, rawSecret string) {
	th.SeedMCPClient(ctx, t, clientID, clientName, redirectURIs, rawSecret)
}

func seedMCPAuthCode(ctx context.Context, t *testing.T, code, userID, clientID, redirectURI, codeChallenge string, expiresAt time.Time) {
	th.SeedMCPAuthCode(ctx, t, code, userID, clientID, redirectURI, codeChallenge, expiresAt, "", "")
}

func seedMCPAuthCodeWithProvider(ctx context.Context, t *testing.T, code, userID, clientID, redirectURI, codeChallenge string, expiresAt time.Time, providerToken, provider string) {
	th.SeedMCPAuthCode(ctx, t, code, userID, clientID, redirectURI, codeChallenge, expiresAt, providerToken, provider)
}

func seedMCPAccessToken(ctx context.Context, t *testing.T, rawToken, userID, clientID string, expiresAt time.Time) {
	th.SeedMCPAccessToken(ctx, t, rawToken, userID, clientID, expiresAt, "", "")
}

func seedMCPAccessTokenWithProvider(ctx context.Context, t *testing.T, rawToken, userID, clientID string, expiresAt time.Time, providerToken, provider string) {
	th.SeedMCPAccessToken(ctx, t, rawToken, userID, clientID, expiresAt, providerToken, provider)
}

type mcpAccessTokenRow struct {
	ID                     uuid.UUID
	TokenHash              string
	UserID                 uuid.UUID
	ClientID               string
	ExpiresAt              time.Time
	Provider               *string
	ProviderToken          *string
	ProviderTokenCheckedAt *time.Time
	LastUsedAt             *time.Time
	Revoked                bool
}

func getMCPAccessToken(ctx context.Context, t *testing.T, tokenHash string) *mcpAccessTokenRow {
	t.Helper()
	var r mcpAccessTokenRow
	err := th.PgPool.QueryRow(ctx,
		`SELECT id, token_hash, user_id, client_id, expires_at, provider, provider_token, provider_token_checked_at, last_used_at, revoked
		 FROM measure.mcp_access_tokens WHERE token_hash = $1`, tokenHash).
		Scan(&r.ID, &r.TokenHash, &r.UserID, &r.ClientID, &r.ExpiresAt, &r.Provider, &r.ProviderToken, &r.ProviderTokenCheckedAt, &r.LastUsedAt, &r.Revoked)
	if err != nil {
		return nil
	}
	return &r
}

type mcpAuthCodeRow struct {
	ID            uuid.UUID
	Code          string
	UserID        uuid.UUID
	ClientID      string
	RedirectURI   string
	CodeChallenge string
	Provider      *string
	ProviderToken *string
	ExpiresAt     time.Time
	Used          bool
}

func getMCPAuthCode(ctx context.Context, t *testing.T, code string) *mcpAuthCodeRow {
	t.Helper()
	var r mcpAuthCodeRow
	err := th.PgPool.QueryRow(ctx,
		`SELECT id, code, user_id, client_id, redirect_uri, code_challenge, provider, provider_token, expires_at, used
		 FROM measure.mcp_auth_codes WHERE code = $1`, code).
		Scan(&r.ID, &r.Code, &r.UserID, &r.ClientID, &r.RedirectURI, &r.CodeChallenge, &r.Provider, &r.ProviderToken, &r.ExpiresAt, &r.Used)
	if err != nil {
		return nil
	}
	return &r
}
